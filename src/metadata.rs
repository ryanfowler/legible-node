use napi::Result;
use napi_derive::napi;

use crate::{
  error::{BindingCompatibilityError, BindingConversionError},
  numeric::js_number_from_usize,
};

type ConversionResult<T> = std::result::Result<T, BindingConversionError>;

/// Metadata returned by a successful extraction.
///
/// Scalar fields are represented as nullable properties in the generated
/// TypeScript declarations. List fields preserve the order supplied by
/// Legible and are always present.
#[napi(object, object_from_js = false, use_nullable = true)]
pub struct Metadata {
  pub title: Option<String>,
  pub description: Option<String>,
  pub authors: Vec<String>,
  pub site_name: Option<String>,
  pub canonical_url: Option<String>,
  pub image: Option<String>,
  pub favicon: Option<String>,
  pub published_time: Option<String>,
  pub modified_time: Option<String>,
  pub language: Option<String>,
  pub direction: Option<String>,
  pub section: Option<String>,
  pub tags: Vec<String>,
}

/// The source of a discovered metadata value.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetadataSource {
  JsonLd,
  OpenGraph,
  Twitter,
  DublinCore,
  Citation,
  HtmlMeta,
  HtmlElement,
  LinkElement,
  Inferred,
}

impl TryFrom<legible_upstream::MetadataSource> for MetadataSource {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::MetadataSource) -> std::result::Result<Self, Self::Error> {
    match value {
      legible_upstream::MetadataSource::JsonLd => Ok(Self::JsonLd),
      legible_upstream::MetadataSource::OpenGraph => Ok(Self::OpenGraph),
      legible_upstream::MetadataSource::Twitter => Ok(Self::Twitter),
      legible_upstream::MetadataSource::DublinCore => Ok(Self::DublinCore),
      legible_upstream::MetadataSource::Citation => Ok(Self::Citation),
      legible_upstream::MetadataSource::HtmlMeta => Ok(Self::HtmlMeta),
      legible_upstream::MetadataSource::HtmlElement => Ok(Self::HtmlElement),
      legible_upstream::MetadataSource::LinkElement => Ok(Self::LinkElement),
      legible_upstream::MetadataSource::Inferred => Ok(Self::Inferred),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible metadata source variant",
      )),
    }
  }
}

/// A metadata value together with provenance and confidence.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct MetadataValue {
  pub value: String,
  pub source: MetadataSource,
  pub confidence: f64,
}

impl MetadataValue {
  fn from_upstream(value: &legible_upstream::MetadataValue<String>) -> ConversionResult<Self> {
    Ok(Self {
      value: value.value.clone(),
      source: value.source.try_into()?,
      confidence: f64::from(value.confidence),
    })
  }
}

/// Selection details for a metadata field with one value.
#[napi(object, object_from_js = false, use_nullable = true)]
#[derive(Debug, Clone)]
pub struct MetadataFieldDiagnostics {
  pub selected: Option<MetadataValue>,
  pub alternatives: Vec<MetadataValue>,
}

impl MetadataFieldDiagnostics {
  fn from_upstream(
    value: &legible_upstream::MetadataFieldDiagnostics<String>,
  ) -> ConversionResult<Self> {
    Ok(Self {
      selected: value
        .selected
        .as_ref()
        .map(MetadataValue::from_upstream)
        .transpose()?,
      alternatives: value
        .alternatives
        .iter()
        .map(MetadataValue::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
    })
  }
}

/// Selection details for a metadata field with many values.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct MetadataListFieldDiagnostics {
  pub selected: Vec<MetadataValue>,
  pub alternatives: Vec<MetadataValue>,
}

impl MetadataListFieldDiagnostics {
  fn from_upstream(
    value: &legible_upstream::MetadataListFieldDiagnostics<String>,
  ) -> ConversionResult<Self> {
    Ok(Self {
      selected: value
        .selected
        .iter()
        .map(MetadataValue::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
      alternatives: value
        .alternatives
        .iter()
        .map(MetadataValue::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
    })
  }
}

/// Provenance and selection details for all public metadata fields.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct MetadataDiagnostics {
  pub title: MetadataFieldDiagnostics,
  pub description: MetadataFieldDiagnostics,
  pub authors: MetadataListFieldDiagnostics,
  pub site_name: MetadataFieldDiagnostics,
  pub canonical_url: MetadataFieldDiagnostics,
  pub image: MetadataFieldDiagnostics,
  pub favicon: MetadataFieldDiagnostics,
  pub published_time: MetadataFieldDiagnostics,
  pub modified_time: MetadataFieldDiagnostics,
  pub language: MetadataFieldDiagnostics,
  pub direction: MetadataFieldDiagnostics,
  pub section: MetadataFieldDiagnostics,
  pub tags: MetadataListFieldDiagnostics,
}

impl MetadataDiagnostics {
  pub(crate) fn from_upstream(
    value: &legible_upstream::MetadataDiagnostics,
  ) -> ConversionResult<Self> {
    Ok(Self {
      title: MetadataFieldDiagnostics::from_upstream(&value.title)?,
      description: MetadataFieldDiagnostics::from_upstream(&value.description)?,
      authors: MetadataListFieldDiagnostics::from_upstream(&value.authors)?,
      site_name: MetadataFieldDiagnostics::from_upstream(&value.site_name)?,
      canonical_url: MetadataFieldDiagnostics::from_upstream(&value.canonical_url)?,
      image: MetadataFieldDiagnostics::from_upstream(&value.image)?,
      favicon: MetadataFieldDiagnostics::from_upstream(&value.favicon)?,
      published_time: MetadataFieldDiagnostics::from_upstream(&value.published_time)?,
      modified_time: MetadataFieldDiagnostics::from_upstream(&value.modified_time)?,
      language: MetadataFieldDiagnostics::from_upstream(&value.language)?,
      direction: MetadataFieldDiagnostics::from_upstream(&value.direction)?,
      section: MetadataFieldDiagnostics::from_upstream(&value.section)?,
      tags: MetadataListFieldDiagnostics::from_upstream(&value.tags)?,
    })
  }
}

impl Metadata {
  /// Convert upstream metadata into a fresh JS-owned result value.
  pub(crate) fn from_upstream(value: &legible_upstream::Metadata) -> Self {
    Self {
      title: value.title.clone(),
      description: value.description.clone(),
      authors: value.authors.clone(),
      site_name: value.site_name.clone(),
      canonical_url: value.canonical_url.clone(),
      image: value.image.clone(),
      favicon: value.favicon.clone(),
      published_time: value.published_time.clone(),
      modified_time: value.modified_time.clone(),
      language: value.language.clone(),
      direction: value.direction.clone(),
      section: value.section.clone(),
      tags: value.tags.clone(),
    }
  }
}

/// Scalar measurements for the retained semantic page content.
#[napi(object, object_from_js = false)]
pub struct PageMetrics {
  pub word_count: f64,
  pub text_length: f64,
  pub link_text_length: f64,
  pub link_density: f64,
  pub paragraph_count: f64,
  pub heading_count: f64,
  pub list_item_count: f64,
  pub code_block_count: f64,
  pub table_count: f64,
  pub figure_count: f64,
  pub image_count: f64,
  pub footnote_reference_count: f64,
  pub footnote_definition_count: f64,
  pub math_count: f64,
  pub structured_block_count: f64,
  pub has_alphanumeric_text: bool,
  pub alphabetic_chars: f64,
  pub digit_chars: f64,
  pub has_contextual_structure: bool,
}

impl PageMetrics {
  /// Collect all public upstream metrics in one native conversion.
  pub(crate) fn from_upstream(value: &legible_upstream::ExtractedPage) -> Result<Self> {
    Ok(Self {
      word_count: js_number_from_usize("wordCount", value.word_count())?,
      text_length: js_number_from_usize("textLength", value.text_length())?,
      link_text_length: js_number_from_usize("linkTextLength", value.link_text_length())?,
      link_density: value.link_density(),
      paragraph_count: js_number_from_usize("paragraphCount", value.paragraph_count())?,
      heading_count: js_number_from_usize("headingCount", value.heading_count())?,
      list_item_count: js_number_from_usize("listItemCount", value.list_item_count())?,
      code_block_count: js_number_from_usize("codeBlockCount", value.code_block_count())?,
      table_count: js_number_from_usize("tableCount", value.table_count())?,
      figure_count: js_number_from_usize("figureCount", value.figure_count())?,
      image_count: js_number_from_usize("imageCount", value.image_count())?,
      footnote_reference_count: js_number_from_usize(
        "footnoteReferenceCount",
        value.footnote_reference_count(),
      )?,
      footnote_definition_count: js_number_from_usize(
        "footnoteDefinitionCount",
        value.footnote_definition_count(),
      )?,
      math_count: js_number_from_usize("mathCount", value.math_count())?,
      structured_block_count: js_number_from_usize(
        "structuredBlockCount",
        value.structured_block_count(),
      )?,
      has_alphanumeric_text: value.has_alphanumeric_text(),
      alphabetic_chars: js_number_from_usize("alphabeticChars", value.alphabetic_chars())?,
      digit_chars: js_number_from_usize("digitChars", value.digit_chars())?,
      has_contextual_structure: value.has_contextual_structure(),
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn metadata_keeps_nullables_and_source_order() {
    let mut upstream = legible_upstream::Metadata::default();
    upstream.title = Some("A title".to_owned());
    upstream.description = Some("A description".to_owned());
    upstream.authors = vec!["First author".to_owned(), "Second author".to_owned()];
    upstream.site_name = Some("Example".to_owned());
    upstream.canonical_url = Some("https://example.com/article".to_owned());
    upstream.image = Some("https://example.com/image.png".to_owned());
    upstream.favicon = Some("https://example.com/favicon.ico".to_owned());
    upstream.published_time = Some("2026-08-26T12:00:00Z".to_owned());
    upstream.modified_time = Some("2026-08-26T13:00:00Z".to_owned());
    upstream.language = Some("en".to_owned());
    upstream.direction = Some("ltr".to_owned());
    upstream.section = Some("Technology".to_owned());
    upstream.tags = vec!["rust".to_owned(), "node".to_owned()];

    let metadata = Metadata::from_upstream(&upstream);

    assert_eq!(metadata.title.as_deref(), Some("A title"));
    assert_eq!(metadata.description.as_deref(), Some("A description"));
    assert_eq!(metadata.authors, upstream.authors);
    assert_eq!(metadata.site_name.as_deref(), Some("Example"));
    assert_eq!(
      metadata.canonical_url.as_deref(),
      Some("https://example.com/article")
    );
    assert_eq!(
      metadata.image.as_deref(),
      Some("https://example.com/image.png")
    );
    assert_eq!(
      metadata.favicon.as_deref(),
      Some("https://example.com/favicon.ico")
    );
    assert_eq!(
      metadata.published_time.as_deref(),
      Some("2026-08-26T12:00:00Z")
    );
    assert_eq!(
      metadata.modified_time.as_deref(),
      Some("2026-08-26T13:00:00Z")
    );
    assert_eq!(metadata.language.as_deref(), Some("en"));
    assert_eq!(metadata.direction.as_deref(), Some("ltr"));
    assert_eq!(metadata.section.as_deref(), Some("Technology"));
    assert_eq!(metadata.tags, upstream.tags);
  }

  #[test]
  fn metadata_keeps_empty_lists_and_null_for_absent_scalars() {
    let metadata = Metadata::from_upstream(&legible_upstream::Metadata::default());

    assert_eq!(metadata.title, None);
    assert_eq!(metadata.description, None);
    assert!(metadata.authors.is_empty());
    assert_eq!(metadata.site_name, None);
    assert_eq!(metadata.canonical_url, None);
    assert_eq!(metadata.image, None);
    assert_eq!(metadata.favicon, None);
    assert_eq!(metadata.published_time, None);
    assert_eq!(metadata.modified_time, None);
    assert_eq!(metadata.language, None);
    assert_eq!(metadata.direction, None);
    assert_eq!(metadata.section, None);
    assert!(metadata.tags.is_empty());
  }

  #[test]
  fn converts_metadata_diagnostics_and_preserves_provenance() {
    let candidate = legible_upstream::MetadataValue {
      value: "A title".to_owned(),
      source: legible_upstream::MetadataSource::OpenGraph,
      confidence: 90,
    };
    let mut upstream = legible_upstream::MetadataDiagnostics::default();
    upstream.title.selected = Some(candidate.clone());
    upstream
      .title
      .alternatives
      .push(legible_upstream::MetadataValue {
        value: "A fallback title".to_owned(),
        source: legible_upstream::MetadataSource::HtmlMeta,
        confidence: 76,
      });
    upstream.authors.selected.push(candidate.clone());
    upstream.tags.alternatives.push(candidate);

    let diagnostics = MetadataDiagnostics::from_upstream(&upstream).unwrap();
    let title = diagnostics.title.selected.as_ref().unwrap();
    assert_eq!(title.value, "A title");
    assert_eq!(title.source, MetadataSource::OpenGraph);
    assert_eq!(title.confidence, 90.0);
    assert_eq!(
      diagnostics.title.alternatives[0].source,
      MetadataSource::HtmlMeta
    );
    assert_eq!(diagnostics.authors.selected.len(), 1);
    assert_eq!(diagnostics.tags.alternatives.len(), 1);
    assert!(diagnostics.description.selected.is_none());
  }

  #[test]
  fn converts_every_metadata_source_variant() {
    let sources = [
      (
        legible_upstream::MetadataSource::JsonLd,
        MetadataSource::JsonLd,
      ),
      (
        legible_upstream::MetadataSource::OpenGraph,
        MetadataSource::OpenGraph,
      ),
      (
        legible_upstream::MetadataSource::Twitter,
        MetadataSource::Twitter,
      ),
      (
        legible_upstream::MetadataSource::DublinCore,
        MetadataSource::DublinCore,
      ),
      (
        legible_upstream::MetadataSource::Citation,
        MetadataSource::Citation,
      ),
      (
        legible_upstream::MetadataSource::HtmlMeta,
        MetadataSource::HtmlMeta,
      ),
      (
        legible_upstream::MetadataSource::HtmlElement,
        MetadataSource::HtmlElement,
      ),
      (
        legible_upstream::MetadataSource::LinkElement,
        MetadataSource::LinkElement,
      ),
      (
        legible_upstream::MetadataSource::Inferred,
        MetadataSource::Inferred,
      ),
    ];

    for (upstream, expected) in sources {
      assert_eq!(MetadataSource::try_from(upstream).unwrap(), expected);
    }
  }

  #[test]
  fn page_metrics_include_every_upstream_measurement() {
    let page = legible_upstream::extract(
      "<main><h1>Metrics</h1><p>One <a href='/two'>two</a> three with enough useful context for extraction.</p><ul><li>Item one</li><li>Item two</li></ul><pre><code>let value = 42;</code></pre><img src='image.png' alt='Image'></main>",
      Some("https://example.com/article"),
    )
    .unwrap();
    let metrics = PageMetrics::from_upstream(&page).unwrap();

    assert_eq!(metrics.word_count, page.word_count() as f64);
    assert_eq!(metrics.text_length, page.text_length() as f64);
    assert_eq!(metrics.link_text_length, page.link_text_length() as f64);
    assert_eq!(metrics.link_density, page.link_density());
    assert_eq!(metrics.paragraph_count, page.paragraph_count() as f64);
    assert_eq!(metrics.heading_count, page.heading_count() as f64);
    assert_eq!(metrics.list_item_count, page.list_item_count() as f64);
    assert_eq!(metrics.code_block_count, page.code_block_count() as f64);
    assert_eq!(metrics.table_count, page.table_count() as f64);
    assert_eq!(metrics.figure_count, page.figure_count() as f64);
    assert_eq!(metrics.image_count, page.image_count() as f64);
    assert_eq!(
      metrics.footnote_reference_count,
      page.footnote_reference_count() as f64
    );
    assert_eq!(
      metrics.footnote_definition_count,
      page.footnote_definition_count() as f64
    );
    assert_eq!(metrics.math_count, page.math_count() as f64);
    assert_eq!(
      metrics.structured_block_count,
      page.structured_block_count() as f64
    );
    assert_eq!(metrics.has_alphanumeric_text, page.has_alphanumeric_text());
    assert_eq!(metrics.alphabetic_chars, page.alphabetic_chars() as f64);
    assert_eq!(metrics.digit_chars, page.digit_chars() as f64);
    assert_eq!(
      metrics.has_contextual_structure,
      page.has_contextual_structure()
    );
  }
}
