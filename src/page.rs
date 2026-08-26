use napi::{Env, Result};
use napi_derive::napi;

use crate::{
  diagnostics::ExtractionDiagnostics,
  error::BindingConversionError,
  metadata::{Metadata, MetadataDiagnostics, PageMetrics},
  numeric::js_safe_usize,
};

/// Options for rendering an extracted page as Markdown.
#[napi(js_name = "MarkdownOptions", object, object_to_js = false)]
pub struct MarkdownOptionsInput {
  /// Whether to render links as Markdown links. Defaults to true.
  pub links: Option<bool>,
  /// Whether to render images. Defaults to true.
  pub images: Option<bool>,
  /// Preferred maximum prose source-line width. Zero disables wrapping.
  pub max_line_width: Option<f64>,
}

/// A retained extracted page with lazy output rendering.
///
/// The upstream page owns the semantic representation. This wrapper does not
/// cache rendered strings or converted result objects.
#[napi]
pub struct ExtractedPage {
  inner: legible_upstream::ExtractedPage,
}

impl ExtractedPage {
  #[allow(dead_code)]
  pub(crate) fn from_upstream(inner: legible_upstream::ExtractedPage) -> Self {
    Self { inner }
  }
}

#[napi]
impl ExtractedPage {
  /// Returns a fresh JavaScript-owned metadata value.
  #[napi(getter)]
  pub fn metadata(&self) -> Metadata {
    Metadata::from_upstream(self.inner.metadata())
  }

  /// Returns all public content measurements in one conversion.
  #[napi(getter)]
  pub fn metrics(&self) -> Result<PageMetrics> {
    PageMetrics::from_upstream(&self.inner)
  }

  /// Returns extraction diagnostics when they were retained.
  #[napi(getter)]
  pub fn diagnostics(&self, env: Env) -> Result<Option<ExtractionDiagnostics>> {
    convert_optional(
      self
        .inner
        .diagnostics()
        .map(ExtractionDiagnostics::from_upstream),
      &env,
    )
  }

  /// Returns metadata diagnostics when they were retained.
  #[napi(getter)]
  pub fn metadata_diagnostics(&self, env: Env) -> Result<Option<MetadataDiagnostics>> {
    convert_optional(
      self
        .inner
        .metadata_diagnostics()
        .map(MetadataDiagnostics::from_upstream),
      &env,
    )
  }

  /// Returns retained structured data, or null when retention was disabled.
  #[napi(getter, ts_return_type = "unknown[] | null")]
  pub fn structured_data(&self) -> Option<Vec<serde_json::Value>> {
    self.inner.structured_data().map(ToOwned::to_owned)
  }

  /// Renders canonical Markdown using the upstream MarkdownBuilder.
  #[napi]
  pub fn markdown(&self, options: Option<MarkdownOptionsInput>) -> Result<String> {
    let mut builder = self.inner.markdown_builder();

    if let Some(options) = options {
      if let Some(links) = options.links {
        builder = builder.links(links);
      }
      if let Some(images) = options.images {
        builder = builder.images(images);
      }
      if let Some(max_line_width) = options.max_line_width {
        builder = builder.max_line_width(js_safe_usize("maxLineWidth", max_line_width)?);
      }
    }

    Ok(builder.render())
  }

  /// Renders normalized plain text lazily.
  #[napi]
  pub fn text(&self) -> String {
    self.inner.text()
  }

  /// Renders canonical semantic HTML lazily.
  #[napi]
  pub fn html(&self) -> String {
    self.inner.html()
  }
}

fn convert_optional<T>(
  value: Option<std::result::Result<T, BindingConversionError>>,
  env: &Env,
) -> Result<Option<T>> {
  value
    .map(|value| match value {
      Ok(value) => Ok(value),
      Err(error) => Err(error.into_napi_error(env)?),
    })
    .transpose()
}

#[cfg(test)]
mod tests {
  use super::*;

  const HTML: &str = r#"
    <html>
      <head><title>A retained page</title></head>
      <body>
        <nav>Navigation</nav>
        <main>
          <h1>A retained page</h1>
          <p>This is enough meaningful content to exercise the retained semantic representation and its deterministic renderers.</p>
          <p>It includes <a href="/article">a useful link</a> and an image.</p>
          <img src="/image.png" alt="An image">
        </main>
      </body>
    </html>
  "#;

  fn upstream_page() -> legible_upstream::ExtractedPage {
    legible_upstream::extract(HTML, Some("https://example.com/page")).unwrap()
  }

  #[test]
  fn retains_upstream_page_and_renders_each_format_lazily_and_deterministically() {
    let upstream = upstream_page();
    let expected_markdown = upstream.markdown();
    let expected_text = upstream.text();
    let expected_html = upstream.html();
    let page = ExtractedPage::from_upstream(upstream);

    assert_eq!(page.markdown(None).unwrap(), expected_markdown);
    assert_eq!(page.markdown(None).unwrap(), expected_markdown);
    assert_eq!(page.text(), expected_text);
    assert_eq!(page.text(), expected_text);
    assert_eq!(page.html(), expected_html);
    assert_eq!(page.html(), expected_html);
  }

  #[test]
  fn markdown_options_match_the_upstream_builder() {
    let upstream = upstream_page();
    let expected = upstream
      .markdown_builder()
      .links(false)
      .images(false)
      .max_line_width(32)
      .render();
    let page = ExtractedPage::from_upstream(upstream);

    let actual = page
      .markdown(Some(MarkdownOptionsInput {
        links: Some(false),
        images: Some(false),
        max_line_width: Some(32.0),
      }))
      .unwrap();

    assert_eq!(actual, expected);
  }

  #[test]
  fn markdown_zero_width_disables_wrapping_like_upstream() {
    let upstream = upstream_page();
    let expected = upstream.markdown_builder().max_line_width(0).render();
    let page = ExtractedPage::from_upstream(upstream);

    let actual = page
      .markdown(Some(MarkdownOptionsInput {
        links: None,
        images: None,
        max_line_width: Some(0.0),
      }))
      .unwrap();

    assert_eq!(actual, expected);
  }

  #[test]
  fn exposes_fresh_metadata_and_metrics_views() {
    let page = ExtractedPage::from_upstream(upstream_page());

    let metadata = page.metadata();
    assert_eq!(metadata.title.as_deref(), Some("A retained page"));
    assert_eq!(metadata.authors, Vec::<String>::new());

    let metrics = page.metrics().unwrap();
    assert!(metrics.word_count > 0.0);
    assert!(metrics.paragraph_count >= 2.0);
  }

  #[test]
  fn structured_data_preserves_upstream_null_and_array_semantics() {
    let without_retention = ExtractedPage::from_upstream(
      legible_upstream::Extractor::builder()
        .retain_structured_data(false)
        .build()
        .extract(HTML, None)
        .unwrap(),
    );
    assert_eq!(without_retention.structured_data(), None);

    let with_retention = ExtractedPage::from_upstream(
      legible_upstream::Extractor::builder()
        .retain_structured_data(true)
        .build()
        .extract(HTML, None)
        .unwrap(),
    );
    assert_eq!(with_retention.structured_data(), Some(Vec::new()));
  }

  #[test]
  fn rejects_invalid_markdown_widths_at_the_js_number_boundary() {
    let page = ExtractedPage::from_upstream(upstream_page());

    for width in [-1.0, 1.5, f64::NAN, f64::INFINITY] {
      let error = page
        .markdown(Some(MarkdownOptionsInput {
          links: None,
          images: None,
          max_line_width: Some(width),
        }))
        .unwrap_err();
      assert_eq!(error.status, napi::Status::InvalidArg);
      assert!(error.reason.contains("maxLineWidth"));
    }
  }
}
