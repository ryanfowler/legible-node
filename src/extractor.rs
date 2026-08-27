use napi::{
  bindgen_prelude::{AsyncTask, Object},
  Env, Result,
};
use napi_derive::napi;

use crate::{
  error::BindingError,
  options::{build_extractor, ContentSelectorInput, ExtractorOptionsInput, ParseBudgetInput},
  page::ExtractedPage,
  task::{async_task, prepare_abort_signal},
};

/// Options that apply to one extraction call on a reusable extractor.
#[napi(js_name = "ExtractCallOptions", object, object_to_js = false)]
pub struct ExtractCallOptionsInput {
  /// Absolute source/base URL used to resolve relative URLs.
  pub url: Option<String>,
}

/// Options that apply to one asynchronous extraction call.
#[napi(js_name = "ExtractAsyncCallOptions", object, object_to_js = false)]
pub struct ExtractAsyncCallOptionsInput {
  /// Absolute source/base URL used to resolve relative URLs.
  pub url: Option<String>,
  /// Cancels the task if it has not started running yet.
  #[napi(ts_type = "AbortSignal | null | undefined")]
  pub signal: Option<Object<'static>>,
}

/// Options for one-shot extraction, including reusable extractor configuration.
#[napi(js_name = "ExtractOptions", object, object_to_js = false)]
pub struct ExtractOptionsInput {
  #[napi(ts_type = "ParseBudget")]
  pub parse_budget: Option<ParseBudgetInput>,
  pub structured_data: Option<bool>,
  pub diagnostics: Option<bool>,
  pub metadata_diagnostics: Option<bool>,
  pub retain_structured_data: Option<bool>,
  #[napi(ts_type = "ContentSelector")]
  pub content_hint: Option<ContentSelectorInput>,
  #[napi(ts_type = "ContentSelector")]
  pub content_root: Option<ContentSelectorInput>,
  pub url: Option<String>,
}

impl ExtractAsyncCallOptionsInput {
  fn into_parts(self) -> (Option<String>, Option<Object<'static>>) {
    (self.url, self.signal)
  }
}

/// Options for asynchronous one-shot extraction.
#[napi(js_name = "ExtractAsyncOptions", object, object_to_js = false)]
pub struct ExtractAsyncOptionsInput {
  #[napi(ts_type = "ParseBudget")]
  pub parse_budget: Option<ParseBudgetInput>,
  pub structured_data: Option<bool>,
  pub diagnostics: Option<bool>,
  pub metadata_diagnostics: Option<bool>,
  pub retain_structured_data: Option<bool>,
  #[napi(ts_type = "ContentSelector")]
  pub content_hint: Option<ContentSelectorInput>,
  #[napi(ts_type = "ContentSelector")]
  pub content_root: Option<ContentSelectorInput>,
  pub url: Option<String>,
  #[napi(ts_type = "AbortSignal | null | undefined")]
  pub signal: Option<Object<'static>>,
}

impl ExtractOptionsInput {
  fn into_parts(self) -> (ExtractorOptionsInput, Option<String>) {
    (
      ExtractorOptionsInput {
        parse_budget: self.parse_budget,
        structured_data: self.structured_data,
        diagnostics: self.diagnostics,
        metadata_diagnostics: self.metadata_diagnostics,
        retain_structured_data: self.retain_structured_data,
        content_hint: self.content_hint,
        content_root: self.content_root,
      },
      self.url,
    )
  }
}

impl ExtractAsyncOptionsInput {
  fn into_parts(
    self,
  ) -> (
    ExtractorOptionsInput,
    Option<String>,
    Option<Object<'static>>,
  ) {
    (
      ExtractorOptionsInput {
        parse_budget: self.parse_budget,
        structured_data: self.structured_data,
        diagnostics: self.diagnostics,
        metadata_diagnostics: self.metadata_diagnostics,
        retain_structured_data: self.retain_structured_data,
        content_hint: self.content_hint,
        content_root: self.content_root,
      },
      self.url,
      self.signal,
    )
  }
}

/// A reusable immutable extraction configuration.
#[napi]
pub struct Extractor {
  inner: legible_upstream::Extractor,
}

#[napi]
impl Extractor {
  /// Builds an extractor from the supplied configuration.
  #[napi(constructor)]
  pub fn new(
    #[napi(ts_arg_type = "ExtractorOptions | null | undefined")] options: Option<
      ExtractorOptionsInput,
    >,
  ) -> Result<Self> {
    Ok(Self {
      inner: build_extractor(options)?,
    })
  }

  /// Extracts a document using this extractor's immutable configuration.
  #[napi]
  pub fn extract(
    &self,
    env: Env,
    html: String,
    options: Option<ExtractCallOptionsInput>,
  ) -> Result<ExtractedPage> {
    let url = options.and_then(|options| options.url);
    extract_sync(&self.inner, &html, url.as_deref(), &env)
  }

  /// Extracts a document on napi-rs's libuv worker pool.
  #[napi(ts_return_type = "Promise<ExtractedPage>")]
  #[allow(private_interfaces)]
  pub fn extract_async(
    &self,
    env: Env,
    html: String,
    options: Option<ExtractAsyncCallOptionsInput>,
  ) -> Result<AsyncTask<crate::task::ExtractTask>> {
    let (url, signal) = options.map_or((None, None), ExtractAsyncCallOptionsInput::into_parts);
    let (signal, pre_aborted, abort_cleanup) = prepare_abort_signal(&env, signal)?;
    Ok(async_task(
      self.inner.clone(),
      html,
      url,
      signal,
      pre_aborted,
      abort_cleanup,
    ))
  }
}

/// Extracts one document using a one-shot configuration.
#[napi]
pub fn extract(
  env: Env,
  html: String,
  #[napi(ts_arg_type = "ExtractOptions | null | undefined")] options: Option<ExtractOptionsInput>,
) -> Result<ExtractedPage> {
  let (extractor_options, url) = options.map_or_else(
    || (None, None),
    |options| {
      let (extractor_options, url) = options.into_parts();
      (Some(extractor_options), url)
    },
  );
  let extractor = build_extractor(extractor_options)?;

  extract_sync(&extractor, &html, url.as_deref(), &env)
}

/// Extracts one document on napi-rs's libuv worker pool.
#[napi(ts_return_type = "Promise<ExtractedPage>")]
#[allow(private_interfaces)]
pub fn extract_async(
  env: Env,
  html: String,
  #[napi(ts_arg_type = "ExtractAsyncOptions | null | undefined")] options: Option<
    ExtractAsyncOptionsInput,
  >,
) -> Result<AsyncTask<crate::task::ExtractTask>> {
  let (extractor_options, url, signal) = options.map_or_else(
    || (None, None, None),
    |options| {
      let (extractor_options, url, signal) = options.into_parts();
      (Some(extractor_options), url, signal)
    },
  );
  let extractor = build_extractor(extractor_options)?;
  let (signal, pre_aborted, abort_cleanup) = prepare_abort_signal(&env, signal)?;

  Ok(async_task(
    extractor,
    html,
    url,
    signal,
    pre_aborted,
    abort_cleanup,
  ))
}

fn extract_sync(
  extractor: &legible_upstream::Extractor,
  html: &str,
  url: Option<&str>,
  env: &Env,
) -> Result<ExtractedPage> {
  let page = BindingError::map_result(extractor.extract(html, url), env)?;
  Ok(ExtractedPage::from_upstream(page))
}

#[cfg(test)]
mod tests {
  use super::*;

  const HTML: &str = r#"
    <html>
      <head><title>Reusable extraction</title></head>
      <body>
        <main>
          <h1>Reusable extraction</h1>
          <p>This document has enough meaningful text to produce a stable extracted page.</p>
          <p>It includes a <a href="/article">relative article link</a>.</p>
        </main>
      </body>
    </html>
  "#;

  fn configured_extractor() -> legible_upstream::Extractor {
    build_extractor(Some(ExtractorOptionsInput {
      parse_budget: None,
      structured_data: Some(false),
      diagnostics: Some(true),
      metadata_diagnostics: None,
      retain_structured_data: None,
      content_hint: None,
      content_root: None,
    }))
    .unwrap()
  }

  #[test]
  fn one_shot_and_reusable_paths_share_configuration_and_results() {
    let (options, url) = ExtractOptionsInput {
      parse_budget: None,
      structured_data: Some(false),
      diagnostics: Some(true),
      metadata_diagnostics: None,
      retain_structured_data: None,
      content_hint: None,
      content_root: None,
      url: Some("https://example.com/story".to_owned()),
    }
    .into_parts();
    let one_shot = build_extractor(Some(options))
      .unwrap()
      .extract(HTML, url.as_deref())
      .unwrap();
    let reusable = configured_extractor()
      .extract(HTML, Some("https://example.com/story"))
      .unwrap();

    assert_eq!(one_shot.metadata().title, reusable.metadata().title);
    assert_eq!(one_shot.metadata().authors, reusable.metadata().authors);
    assert_eq!(one_shot.markdown(), reusable.markdown());
    assert_eq!(one_shot.text(), reusable.text());
    assert_eq!(one_shot.html(), reusable.html());
    assert_eq!(one_shot.diagnostics(), reusable.diagnostics());
  }

  #[test]
  fn a_reusable_extractor_does_not_leak_document_state_between_calls() {
    let extractor = configured_extractor();
    let first = extractor
      .extract(HTML, Some("https://example.com/first"))
      .unwrap();
    let second = extractor
      .extract(
        HTML
          .replace("Reusable extraction", "Second document")
          .as_str(),
        Some("https://example.com/second"),
      )
      .unwrap();

    assert_eq!(
      first.metadata().title.as_deref(),
      Some("Reusable extraction")
    );
    assert_eq!(second.metadata().title.as_deref(), Some("Second document"));
    assert!(first.markdown().contains("https://example.com/article"));
    assert!(second.markdown().contains("https://example.com/article"));
    assert!(!second.markdown().contains("first"));
    assert!(!second.markdown().contains("Reusable extraction"));
  }

  #[test]
  fn invalid_urls_remain_upstream_domain_errors_for_binding_mapping() {
    let error = match configured_extractor().extract(HTML, Some("relative")) {
      Ok(_) => panic!("a relative URL must be rejected by the upstream API"),
      Err(error) => error,
    };
    let mapped = BindingError::from(error);

    assert_eq!(mapped.code, crate::error::ERR_INVALID_URL);
  }
}
