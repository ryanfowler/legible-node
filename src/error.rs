use napi::{bindgen_prelude::JsObjectValue, Env, Error as NapiError, JsValue, Result, Status};

use crate::numeric::js_number_from_usize;

pub(crate) const LEGIBLE_ERROR_NAME: &str = "LegibleError";

pub(crate) const ERR_INVALID_URL: &str = "ERR_LEGIBLE_INVALID_URL";
pub(crate) const ERR_NO_BODY: &str = "ERR_LEGIBLE_NO_BODY";
pub(crate) const ERR_NO_CONTENT: &str = "ERR_LEGIBLE_NO_CONTENT";
pub(crate) const ERR_CONTENT_ROOT_NOT_FOUND: &str = "ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND";
pub(crate) const ERR_TOO_MANY_ELEMENTS: &str = "ERR_LEGIBLE_TOO_MANY_ELEMENTS";
pub(crate) const ERR_RESOURCE_LIMIT: &str = "ERR_LEGIBLE_RESOURCE_LIMIT";
pub(crate) const ERR_PARSE: &str = "ERR_LEGIBLE_PARSE";
pub(crate) const ERR_BINDING_INCOMPATIBLE: &str = "ERR_LEGIBLE_BINDING_INCOMPATIBLE";

/// A Rust-side error that can be converted into the structured JavaScript
/// error contract once a N-API environment is available.
#[derive(Debug, Eq, PartialEq)]
pub(crate) struct BindingError {
  pub(crate) code: &'static str,
  pub(crate) message: String,
  pub(crate) resource: Option<&'static str>,
  pub(crate) limit: Option<usize>,
  pub(crate) observed: Option<usize>,
}

impl BindingError {
  fn new(code: &'static str, message: String) -> Self {
    Self {
      code,
      message,
      resource: None,
      limit: None,
      observed: None,
    }
  }

  pub(crate) fn binding_incompatible(message: impl Into<String>) -> Self {
    Self::new(ERR_BINDING_INCOMPATIBLE, message.into())
  }

  /// Convert an upstream extraction result for a synchronous N-API method.
  /// Async tasks should keep the `BindingError` until `resolve`, where an
  /// `Env` is available and `into_napi_error` can retain the JS Error object.
  pub(crate) fn map_result<T>(
    result: std::result::Result<T, legible_upstream::Error>,
    env: &Env,
  ) -> Result<T> {
    match result {
      Ok(value) => Ok(value),
      Err(error) => Err(Self::from(error).into_napi_error(env)?),
    }
  }

  /// Turn this domain error into a JavaScript Error while retaining its
  /// custom properties for napi-rs to throw or reject unchanged.
  pub(crate) fn into_napi_error(self, env: &Env) -> Result<NapiError> {
    let mut error =
      env.create_error(NapiError::new(Status::GenericFailure, self.message.clone()))?;
    error.set_named_property("name", LEGIBLE_ERROR_NAME)?;
    error.set_named_property("code", self.code)?;

    if let Some(resource) = self.resource {
      error.set_named_property("resource", resource)?;
    }
    if let Some(limit) = self.limit {
      error.set_named_property("limit", js_number_from_usize("limit", limit)?)?;
    }
    if let Some(observed) = self.observed {
      error.set_named_property("observed", js_number_from_usize("observed", observed)?)?;
    }

    Ok(NapiError::from_unknown_without_coercion(error.to_unknown()))
  }
}

impl From<legible_upstream::Error> for BindingError {
  fn from(error: legible_upstream::Error) -> Self {
    let message = error.to_string();

    match error {
      legible_upstream::Error::InvalidUrl(_) => Self::new(ERR_INVALID_URL, message),
      legible_upstream::Error::NoBody => Self::new(ERR_NO_BODY, message),
      legible_upstream::Error::NoContent => Self::new(ERR_NO_CONTENT, message),
      legible_upstream::Error::ContentRootNotFound => {
        Self::new(ERR_CONTENT_ROOT_NOT_FOUND, message)
      }
      legible_upstream::Error::TooManyElements { observed, limit } => Self {
        code: ERR_TOO_MANY_ELEMENTS,
        message,
        resource: Some("elements"),
        limit: Some(limit),
        observed: Some(observed),
      },
      legible_upstream::Error::ResourceLimit { resource, limit } => {
        let resource = match checked_resource_name(resource.name()) {
          Ok(resource) => resource,
          Err(error) => return error.into(),
        };

        Self {
          code: ERR_RESOURCE_LIMIT,
          message,
          resource: Some(resource),
          limit: Some(limit),
          observed: None,
        }
      }
      legible_upstream::Error::Parse(_) => Self::new(ERR_PARSE, message),
    }
  }
}

fn checked_resource_name(
  name: &'static str,
) -> std::result::Result<&'static str, BindingCompatibilityError> {
  match name {
    "input_bytes"
    | "dom_nodes"
    | "elements"
    | "total_attributes"
    | "attributes_per_element"
    | "text_bytes"
    | "element_depth"
    | "json_ld_bytes"
    | "json_ld_items"
    | "json_ld_depth" => Ok(name),
    _ => Err(BindingCompatibilityError::new(format!(
      "unsupported Legible resource limit kind: {name}"
    ))),
  }
}

/// Error used by fallible conversions from upstream non-exhaustive enums.
#[derive(Debug, Eq, PartialEq)]
pub(crate) struct BindingCompatibilityError {
  message: String,
}

impl BindingCompatibilityError {
  pub(crate) fn new(message: impl Into<String>) -> Self {
    Self {
      message: message.into(),
    }
  }
}

impl From<BindingCompatibilityError> for BindingError {
  fn from(error: BindingCompatibilityError) -> Self {
    Self::binding_incompatible(error.message)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_mapping(
    error: legible_upstream::Error,
    code: &'static str,
    resource: Option<&'static str>,
    limit: Option<usize>,
    observed: Option<usize>,
  ) {
    let mapped = BindingError::from(error);

    assert_eq!(mapped.code, code);
    assert_eq!(mapped.resource, resource);
    assert_eq!(mapped.limit, limit);
    assert_eq!(mapped.observed, observed);
    assert!(!mapped.message.is_empty());
  }

  #[test]
  fn maps_each_domain_error_variant() {
    assert_mapping(
      legible_upstream::Error::TooManyElements {
        observed: 12,
        limit: 10,
      },
      ERR_TOO_MANY_ELEMENTS,
      Some("elements"),
      Some(10),
      Some(12),
    );
    assert_mapping(
      legible_upstream::Error::Parse("bad markup".to_owned()),
      ERR_PARSE,
      None,
      None,
      None,
    );
    assert_mapping(
      legible_upstream::Error::NoContent,
      ERR_NO_CONTENT,
      None,
      None,
      None,
    );
    assert_mapping(
      legible_upstream::Error::NoBody,
      ERR_NO_BODY,
      None,
      None,
      None,
    );
    assert_mapping(
      legible_upstream::Error::ContentRootNotFound,
      ERR_CONTENT_ROOT_NOT_FOUND,
      None,
      None,
      None,
    );
  }

  #[test]
  fn maps_invalid_url_errors_without_exposing_parser_details() {
    let error =
      match legible_upstream::extract("<html><body>content</body></html>", Some("relative")) {
        Ok(_) => panic!("a relative URL must be rejected by the upstream API"),
        Err(error) => error,
      };

    assert_mapping(error, ERR_INVALID_URL, None, None, None);
  }

  #[test]
  fn maps_every_resource_limit_name_from_upstream() {
    let cases = [
      (
        legible_upstream::ResourceLimitKind::InputBytes,
        "input_bytes",
      ),
      (legible_upstream::ResourceLimitKind::DomNodes, "dom_nodes"),
      (legible_upstream::ResourceLimitKind::Elements, "elements"),
      (
        legible_upstream::ResourceLimitKind::TotalAttributes,
        "total_attributes",
      ),
      (
        legible_upstream::ResourceLimitKind::AttributesPerElement,
        "attributes_per_element",
      ),
      (legible_upstream::ResourceLimitKind::TextBytes, "text_bytes"),
      (
        legible_upstream::ResourceLimitKind::ElementDepth,
        "element_depth",
      ),
      (
        legible_upstream::ResourceLimitKind::JsonLdBytes,
        "json_ld_bytes",
      ),
      (
        legible_upstream::ResourceLimitKind::JsonLdItems,
        "json_ld_items",
      ),
      (
        legible_upstream::ResourceLimitKind::JsonLdDepth,
        "json_ld_depth",
      ),
    ];

    for (resource, expected_name) in cases {
      let mapped = BindingError::from(legible_upstream::Error::ResourceLimit {
        resource,
        limit: 25,
      });

      assert_eq!(mapped.code, ERR_RESOURCE_LIMIT);
      assert_eq!(mapped.resource, Some(expected_name));
      assert_eq!(mapped.limit, Some(25));
      assert_eq!(mapped.observed, None);
    }
  }

  #[test]
  fn rejects_resource_names_outside_the_public_union() {
    let error = checked_resource_name("future_resource").unwrap_err();

    assert_eq!(
      error.message,
      "unsupported Legible resource limit kind: future_resource"
    );
    assert_eq!(BindingError::from(error).code, ERR_BINDING_INCOMPATIBLE);
  }

  #[test]
  fn maps_compatibility_errors_to_a_stable_code() {
    let mapped = BindingError::from(BindingCompatibilityError::new(
      "unsupported upstream diagnostic variant",
    ));

    assert_eq!(mapped.code, ERR_BINDING_INCOMPATIBLE);
    assert_eq!(mapped.message, "unsupported upstream diagnostic variant");
    assert_eq!(mapped.resource, None);
    assert_eq!(mapped.limit, None);
    assert_eq!(mapped.observed, None);
  }
}
