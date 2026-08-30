use napi::{
  bindgen_prelude::{
    AbortSignal, AsyncTask, FnArgs, FromNapiValue, Function, FunctionRef, JsObjectValue, Object,
    ObjectRef, ToNapiValue,
  },
  Env, Error as NapiError, JsValue, Result, Status, Task,
};

use std::sync::{Arc, Mutex};

use crate::{
  error::BindingError,
  page::{ExtractedOutput, ExtractedPage, OutputRequest},
};

/// The owned work item sent to napi-rs's libuv worker pool.
///
/// The input strings and immutable extractor are owned by the task so no JS
/// values or N-API environment state are accessed from `compute`.
pub(crate) struct ExtractTask {
  pub(crate) extractor: legible_upstream::Extractor,
  pub(crate) html: String,
  pub(crate) url: Option<String>,
  pub(crate) output: Option<OutputRequest>,
  pub(crate) pre_aborted: bool,
  pub(crate) abort_cleanup: Option<AbortSignalCleanup>,
}

type AbortListener<'env> = Function<'env, (), ()>;
type EventListenerMethod<'env> = Function<'env, FnArgs<(String, AbortListener<'env>)>, ()>;

pub(crate) struct AbortSignalCleanup {
  signal: ObjectRef<false>,
  listener: FunctionRef<(), ()>,
  proxy: Arc<Mutex<Option<ObjectRef<false>>>>,
}

impl AbortSignalCleanup {
  fn remove(self, env: &Env) -> Result<()> {
    let Self {
      signal,
      listener,
      proxy,
    } = self;
    let removal_result = (|| {
      let signal = signal.get_value(env)?;
      let listener = listener.borrow_back(env)?;
      let remove_event_listener: EventListenerMethod<'_> =
        signal.get_named_property("removeEventListener")?;
      remove_event_listener.apply(signal, ("abort".to_owned(), listener).into())
    })();
    let signal_result = signal.unref(env);
    let proxy_result = release_proxy_reference(&proxy, env);

    removal_result?;
    signal_result?;
    proxy_result
  }
}

impl Task for ExtractTask {
  type Output =
    std::result::Result<(legible_upstream::ExtractedPage, Option<ExtractedOutput>), BindingError>;
  type JsValue = ExtractedPage;

  fn compute(&mut self) -> Result<Self::Output> {
    if self.pre_aborted {
      return Err(NapiError::new(Status::Cancelled, "AbortError"));
    }

    // Keep domain errors in the task output. This lets resolve construct the
    // JavaScript Error with its stable custom properties on the JS thread.
    Ok(
      self
        .extractor
        .extract(&self.html, self.url.as_deref())
        .map(|page| {
          let output = self.output.take().map(|output| output.render(&page));
          (page, output)
        })
        .map_err(BindingError::from),
    )
  }

  fn resolve(&mut self, env: Env, output: Self::Output) -> Result<Self::JsValue> {
    match output {
      Ok((page, output)) => Ok(ExtractedPage::from_upstream_with_output(page, output)),
      Err(error) => Err(error.into_napi_error(&env)?),
    }
  }

  fn reject(&mut self, env: Env, _error: NapiError) -> Result<Self::JsValue> {
    let mut error = env.create_error(NapiError::new(Status::Cancelled, "AbortError"))?;
    error.set_named_property("name", "AbortError")?;
    Err(NapiError::from_unknown_without_coercion(error.to_unknown()))
  }

  fn finally(self, env: Env) -> Result<()> {
    if let Some(cleanup) = self.abort_cleanup {
      // Cleanup must not prevent napi-rs from deleting its async-work handle.
      // The cleanup operation releases all references even when removal fails.
      let _ = cleanup.remove(&env);
    }
    Ok(())
  }
}

/// Adapts a JavaScript AbortSignal without changing its `onabort` property.
///
/// napi-rs's `AbortSignal` adapter installs a callback by assigning
/// `onabort`. A private proxy lets each task have an independent adapter while
/// an `abort` event listener on the caller's signal preserves existing
/// handlers and makes shared signals safe to reuse.
pub(crate) fn prepare_abort_signal(
  env: &Env,
  signal: Option<Object<'static>>,
) -> Result<(Option<AbortSignal>, bool, Option<AbortSignalCleanup>)> {
  let Some(signal) = signal else {
    return Ok((None, false, None));
  };

  if signal.get_named_property::<bool>("aborted")? {
    return Ok((None, true, None));
  }

  let add_event_listener: EventListenerMethod<'_> =
    signal.get_named_property("addEventListener")?;
  let proxy = Object::new(env)?;
  let proxy_ref = Arc::new(Mutex::new(Some(proxy.create_ref::<false>()?)));
  let listener_proxy_ref = Arc::clone(&proxy_ref);
  let listener = match env.create_function_from_closure::<(), (), _>("onAbort", move |context| {
    let proxy_ref = listener_proxy_ref
      .lock()
      .map_err(|_| NapiError::new(Status::GenericFailure, "AbortSignal proxy lock poisoned"))?;
    let proxy = proxy_ref
      .as_ref()
      .ok_or_else(|| NapiError::new(Status::GenericFailure, "AbortSignal proxy released"))?
      .get_value(context.env)?;
    let on_abort: Function<(), ()> = proxy.get_named_property("onabort")?;
    on_abort.apply(proxy, ())?;
    Ok(())
  }) {
    Ok(listener) => listener,
    Err(error) => {
      let _ = release_proxy_reference(&proxy_ref, env);
      return Err(error);
    }
  };

  // Set up the private adapter before registering the caller's event
  // listener. This leaves no fallible operation after registration that could
  // strand a JS listener.
  let proxy_value = match unsafe { ToNapiValue::to_napi_value(env.raw(), proxy) } {
    Ok(value) => value,
    Err(error) => {
      let _ = release_proxy_reference(&proxy_ref, env);
      return Err(error);
    }
  };
  let abort_signal = match unsafe { AbortSignal::from_napi_value(env.raw(), proxy_value) } {
    Ok(signal) => signal,
    Err(error) => {
      let _ = release_proxy_reference(&proxy_ref, env);
      return Err(error);
    }
  };
  let signal_ref = match signal.create_ref::<false>() {
    Ok(reference) => reference,
    Err(error) => {
      let _ = release_proxy_reference(&proxy_ref, env);
      return Err(error);
    }
  };
  let listener_ref = match listener.create_ref() {
    Ok(reference) => reference,
    Err(error) => {
      let _ = signal_ref.unref(env);
      let _ = release_proxy_reference(&proxy_ref, env);
      return Err(error);
    }
  };
  let cleanup = AbortSignalCleanup {
    signal: signal_ref,
    listener: listener_ref,
    proxy: proxy_ref,
  };

  if let Err(error) = add_event_listener.apply(signal, ("abort".to_owned(), listener).into()) {
    let AbortSignalCleanup {
      signal,
      listener,
      proxy,
    } = cleanup;
    let _ = signal.unref(env);
    let _ = release_proxy_reference(&proxy, env);
    drop(listener);
    return Err(error);
  }

  Ok((Some(abort_signal), false, Some(cleanup)))
}

fn release_proxy_reference(proxy: &Arc<Mutex<Option<ObjectRef<false>>>>, env: &Env) -> Result<()> {
  let reference = proxy
    .lock()
    .map_err(|_| NapiError::new(Status::GenericFailure, "AbortSignal proxy lock poisoned"))?
    .take();
  if let Some(reference) = reference {
    reference.unref(env)?;
  }
  Ok(())
}

pub(crate) fn async_task(
  extractor: legible_upstream::Extractor,
  html: String,
  url: Option<String>,
  output: Option<OutputRequest>,
  signal: Option<AbortSignal>,
  pre_aborted: bool,
  abort_cleanup: Option<AbortSignalCleanup>,
) -> AsyncTask<ExtractTask> {
  AsyncTask::with_optional_signal(
    ExtractTask {
      extractor,
      html,
      url,
      output,
      pre_aborted,
      abort_cleanup,
    },
    signal,
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send<T: Send>() {}

  #[test]
  fn task_inputs_and_output_are_send() {
    assert_send::<ExtractTask>();
    assert_send::<<ExtractTask as Task>::Output>();
  }

  #[test]
  fn compute_keeps_domain_errors_for_resolve() {
    let mut task = ExtractTask {
      extractor: legible_upstream::Extractor::builder().build(),
      html: "<html><body><p>content</p></body></html>".to_owned(),
      url: Some("relative".to_owned()),
      output: None,
      pre_aborted: false,
      abort_cleanup: None,
    };

    let output = task.compute().unwrap();
    let error = match output {
      Ok(_) => panic!("relative URL must produce a domain error"),
      Err(error) => error,
    };
    assert_eq!(error.code, crate::error::ERR_INVALID_URL);
    assert!(!error.message.is_empty());
  }

  #[test]
  fn pre_aborted_tasks_fail_before_extraction() {
    let mut task = ExtractTask {
      extractor: legible_upstream::Extractor::builder().build(),
      html: String::new(),
      url: None,
      output: None,
      pre_aborted: true,
      abort_cleanup: None,
    };

    let result = task.compute();
    match result {
      Ok(_) => panic!("a pre-aborted task must not extract"),
      Err(error) => assert_eq!(error.status, Status::Cancelled),
    }
  }

  #[test]
  fn compute_renders_requested_outputs_on_the_worker_task() {
    let html = "<main><h1>Rendered output</h1><p>This content is long enough to extract and render in the background worker task.</p></main>";
    let upstream = legible_upstream::extract(html, None).unwrap();
    let expected_text = upstream.text();
    let expected_html = upstream.html();
    let mut task = ExtractTask {
      extractor: legible_upstream::Extractor::builder().build(),
      html: html.to_owned(),
      url: None,
      output: Some(
        crate::page::ExtractOutputOptionsInput {
          markdown: None,
          html: Some(true),
          text: Some(true),
        }
        .into_request()
        .unwrap(),
      ),
      pre_aborted: false,
      abort_cleanup: None,
    };

    let (_, output) = task.compute().unwrap().unwrap();
    let output = output.unwrap();
    assert_eq!(output.text.as_deref(), Some(expected_text.as_str()));
    assert_eq!(output.html.as_deref(), Some(expected_html.as_str()));
    assert!(output.markdown.is_none());
  }
}
