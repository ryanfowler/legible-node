use napi::{Error, Result, Status};
use napi_derive::napi;

use crate::numeric::js_safe_usize;

/// A content tag accepted by Legible's content selectors.
#[napi(string_enum = "lowercase", js_name = "ContentTag")]
pub enum ContentTagInput {
  Article,
  Main,
  Section,
  Div,
}

/// A typed selector for content hints and exact content roots.
#[napi(
  js_name = "ContentSelector",
  discriminant = "type",
  discriminant_case = "camelCase",
  object_to_js = false
)]
pub enum ContentSelectorInput {
  Id { value: String },
  Class { value: String },
  Tag { value: ContentTagInput },
}

impl ContentSelectorInput {
  pub(crate) fn into_content_hint(self) -> Result<legible_upstream::ContentHint> {
    match self {
      Self::Id { value } => {
        if value.is_empty() {
          return Err(invalid_arg("content selector id must not be empty"));
        }
        Ok(legible_upstream::ContentHint::Id(value))
      }
      Self::Class { value } => {
        if value.is_empty() {
          return Err(invalid_arg("content selector class must not be empty"));
        }
        if value.chars().any(char::is_whitespace) {
          return Err(invalid_arg(
            "content selector class must be a single class token",
          ));
        }
        Ok(legible_upstream::ContentHint::Class(value))
      }
      Self::Tag { value } => Ok(legible_upstream::ContentHint::Tag(value.into_content_tag())),
    }
  }
}

impl ContentTagInput {
  fn into_content_tag(self) -> legible_upstream::ContentTag {
    match self {
      Self::Article => legible_upstream::ContentTag::Article,
      Self::Main => legible_upstream::ContentTag::Main,
      Self::Section => legible_upstream::ContentTag::Section,
      Self::Div => legible_upstream::ContentTag::Div,
    }
  }
}

/// Parser and structured-data resource limits.
#[napi(js_name = "ParseBudget", object, object_to_js = false)]
pub struct ParseBudgetInput {
  pub max_input_bytes: Option<f64>,
  pub max_nodes: Option<f64>,
  pub max_elements: Option<f64>,
  pub max_total_attributes: Option<f64>,
  pub max_attributes_per_element: Option<f64>,
  pub max_text_bytes: Option<f64>,
  pub max_depth: Option<f64>,
  pub max_json_ld_bytes: Option<f64>,
  pub max_json_ld_items: Option<f64>,
  pub max_json_ld_depth: Option<f64>,
}

impl ParseBudgetInput {
  pub(crate) fn into_parse_budget(self) -> Result<legible_upstream::ParseBudget> {
    Ok(legible_upstream::ParseBudget {
      max_input_bytes: optional_usize("maxInputBytes", self.max_input_bytes)?,
      max_nodes: optional_usize("maxNodes", self.max_nodes)?,
      max_elements: optional_usize("maxElements", self.max_elements)?,
      max_total_attributes: optional_usize("maxTotalAttributes", self.max_total_attributes)?,
      max_attributes_per_element: optional_usize(
        "maxAttributesPerElement",
        self.max_attributes_per_element,
      )?,
      max_text_bytes: optional_usize("maxTextBytes", self.max_text_bytes)?,
      max_depth: optional_usize("maxDepth", self.max_depth)?,
      max_json_ld_bytes: optional_usize("maxJsonLdBytes", self.max_json_ld_bytes)?,
      max_json_ld_items: optional_usize("maxJsonLdItems", self.max_json_ld_items)?,
      max_json_ld_depth: optional_usize("maxJsonLdDepth", self.max_json_ld_depth)?,
    })
  }
}

/// Reusable extractor configuration.
#[napi(js_name = "ExtractorOptions", object, object_to_js = false)]
pub struct ExtractorOptionsInput {
  pub parse_budget: Option<ParseBudgetInput>,
  pub structured_data: Option<bool>,
  pub diagnostics: Option<bool>,
  pub metadata_diagnostics: Option<bool>,
  pub retain_structured_data: Option<bool>,
  pub content_hint: Option<ContentSelectorInput>,
  pub content_root: Option<ContentSelectorInput>,
}

pub(crate) fn build_extractor(
  options: Option<ExtractorOptionsInput>,
) -> Result<legible_upstream::Extractor> {
  let mut builder = legible_upstream::Extractor::builder();

  let Some(options) = options else {
    return Ok(builder.build());
  };

  if let Some(parse_budget) = options.parse_budget {
    builder = builder.parse_budget(parse_budget.into_parse_budget()?);
  }
  if let Some(structured_data) = options.structured_data {
    builder = builder.structured_data(structured_data);
  }
  if let Some(diagnostics) = options.diagnostics {
    builder = builder.diagnostics(diagnostics);
  }
  if let Some(metadata_diagnostics) = options.metadata_diagnostics {
    builder = builder.metadata_diagnostics(metadata_diagnostics);
  }
  if let Some(retain_structured_data) = options.retain_structured_data {
    builder = builder.retain_structured_data(retain_structured_data);
  }
  if let Some(content_hint) = options.content_hint {
    builder = builder.content_hint(content_hint.into_content_hint()?);
  }
  if let Some(content_root) = options.content_root {
    builder = builder.content_root(content_root.into_content_hint()?);
  }

  Ok(builder.build())
}

fn optional_usize(field: &'static str, value: Option<f64>) -> Result<usize> {
  value.map_or(Ok(0), |value| js_safe_usize(field, value))
}

fn invalid_arg(message: &'static str) -> Error {
  Error::new(Status::InvalidArg, message)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn converts_all_content_tag_variants() {
    assert_eq!(
      ContentSelectorInput::Tag {
        value: ContentTagInput::Article,
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Tag(legible_upstream::ContentTag::Article)
    );
    assert_eq!(
      ContentSelectorInput::Tag {
        value: ContentTagInput::Main,
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Tag(legible_upstream::ContentTag::Main)
    );
    assert_eq!(
      ContentSelectorInput::Tag {
        value: ContentTagInput::Section,
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Tag(legible_upstream::ContentTag::Section)
    );
    assert_eq!(
      ContentSelectorInput::Tag {
        value: ContentTagInput::Div,
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Tag(legible_upstream::ContentTag::Div)
    );
  }

  #[test]
  fn converts_id_and_class_selectors() {
    assert_eq!(
      ContentSelectorInput::Id {
        value: "article".to_owned(),
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Id("article".to_owned())
    );
    assert_eq!(
      ContentSelectorInput::Class {
        value: "article-body".to_owned(),
      }
      .into_content_hint()
      .unwrap(),
      legible_upstream::ContentHint::Class("article-body".to_owned())
    );
  }

  #[test]
  fn rejects_empty_id_and_class_selectors() {
    let id_error = ContentSelectorInput::Id {
      value: String::new(),
    }
    .into_content_hint()
    .unwrap_err();
    let class_error = ContentSelectorInput::Class {
      value: String::new(),
    }
    .into_content_hint()
    .unwrap_err();

    assert_eq!(id_error.status, Status::InvalidArg);
    assert_eq!(class_error.status, Status::InvalidArg);
  }

  #[test]
  fn rejects_whitespace_in_class_selectors() {
    for value in ["article body", "article\tbody", "article\u{00a0}body"] {
      let error = ContentSelectorInput::Class {
        value: value.to_owned(),
      }
      .into_content_hint()
      .unwrap_err();

      assert_eq!(error.status, Status::InvalidArg);
    }
  }

  #[test]
  fn converts_every_parse_budget_field() {
    let budget = ParseBudgetInput {
      max_input_bytes: Some(1.0),
      max_nodes: Some(2.0),
      max_elements: Some(3.0),
      max_total_attributes: Some(4.0),
      max_attributes_per_element: Some(5.0),
      max_text_bytes: Some(6.0),
      max_depth: Some(7.0),
      max_json_ld_bytes: Some(8.0),
      max_json_ld_items: Some(9.0),
      max_json_ld_depth: Some(10.0),
    }
    .into_parse_budget()
    .unwrap();

    assert_eq!(
      budget,
      legible_upstream::ParseBudget {
        max_input_bytes: 1,
        max_nodes: 2,
        max_elements: 3,
        max_total_attributes: 4,
        max_attributes_per_element: 5,
        max_text_bytes: 6,
        max_depth: 7,
        max_json_ld_bytes: 8,
        max_json_ld_items: 9,
        max_json_ld_depth: 10,
      }
    );
  }

  #[test]
  fn omitted_and_zero_budget_fields_are_unlimited() {
    let omitted = ParseBudgetInput {
      max_input_bytes: None,
      max_nodes: None,
      max_elements: None,
      max_total_attributes: None,
      max_attributes_per_element: None,
      max_text_bytes: None,
      max_depth: None,
      max_json_ld_bytes: None,
      max_json_ld_items: None,
      max_json_ld_depth: None,
    }
    .into_parse_budget()
    .unwrap();
    let zero = ParseBudgetInput {
      max_input_bytes: Some(0.0),
      max_nodes: Some(0.0),
      max_elements: Some(0.0),
      max_total_attributes: Some(0.0),
      max_attributes_per_element: Some(0.0),
      max_text_bytes: Some(0.0),
      max_depth: Some(0.0),
      max_json_ld_bytes: Some(0.0),
      max_json_ld_items: Some(0.0),
      max_json_ld_depth: Some(0.0),
    }
    .into_parse_budget()
    .unwrap();

    assert_eq!(omitted, legible_upstream::ParseBudget::default());
    assert_eq!(zero, legible_upstream::ParseBudget::default());
  }

  #[test]
  fn invalid_budget_values_name_the_camel_case_field() {
    let error = ParseBudgetInput {
      max_input_bytes: Some(1.5),
      max_nodes: None,
      max_elements: None,
      max_total_attributes: None,
      max_attributes_per_element: None,
      max_text_bytes: None,
      max_depth: None,
      max_json_ld_bytes: None,
      max_json_ld_items: None,
      max_json_ld_depth: None,
    }
    .into_parse_budget()
    .unwrap_err();

    assert_eq!(error.status, Status::InvalidArg);
    assert!(error.reason.contains("maxInputBytes"));
  }

  #[test]
  fn applies_all_extractor_options() {
    let extractor = build_extractor(Some(ExtractorOptionsInput {
      parse_budget: Some(ParseBudgetInput {
        max_input_bytes: Some(1.0),
        max_nodes: Some(2.0),
        max_elements: Some(3.0),
        max_total_attributes: Some(4.0),
        max_attributes_per_element: Some(5.0),
        max_text_bytes: Some(6.0),
        max_depth: Some(7.0),
        max_json_ld_bytes: Some(8.0),
        max_json_ld_items: Some(9.0),
        max_json_ld_depth: Some(10.0),
      }),
      structured_data: Some(false),
      diagnostics: Some(true),
      metadata_diagnostics: Some(false),
      retain_structured_data: Some(true),
      content_hint: Some(ContentSelectorInput::Tag {
        value: ContentTagInput::Section,
      }),
      content_root: Some(ContentSelectorInput::Id {
        value: "article".to_owned(),
      }),
    }))
    .unwrap();

    let debug = format!("{extractor:?}");
    for expected in [
      "max_input_bytes: 1",
      "max_nodes: 2",
      "max_elements: 3",
      "max_total_attributes: 4",
      "max_attributes_per_element: 5",
      "max_text_bytes: 6",
      "max_depth: 7",
      "max_json_ld_bytes: 8",
      "max_json_ld_items: 9",
      "max_json_ld_depth: 10",
    ] {
      assert!(debug.contains(expected), "missing {expected} in {debug}");
    }
    assert!(debug.contains("structured_data: false"));
    assert!(debug.contains("diagnostics: true"));
    assert!(debug.contains("metadata_diagnostics: false"));
    assert!(debug.contains("retain_structured_data: true"));
    assert!(debug.contains("content_hint: Some(Tag(Section))"));
    assert!(debug.contains("content_root: Some(Id(\"article\"))"));
  }
}
