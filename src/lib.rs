#![deny(clippy::all)]

mod numeric;

#[cfg(test)]
mod upstream_api_tests {
  fn assert_send<T: Send>() {}
  fn assert_sync<T: Sync>() {}

  #[test]
  fn upstream_page_and_extractor_are_send_and_sync() {
    // Keep these positive assertions active before implementing AsyncTask.
    assert_send::<legible_upstream::ExtractedPage>();
    assert_sync::<legible_upstream::ExtractedPage>();
    assert_send::<legible_upstream::Extractor>();
    assert_sync::<legible_upstream::Extractor>();
  }

  #[test]
  fn upstream_extraction_api_is_available() {
    let _: fn(
      &str,
      Option<&str>,
    ) -> Result<legible_upstream::ExtractedPage, legible_upstream::Error> =
      legible_upstream::extract;

    let _: fn() -> legible_upstream::ExtractorBuilder = legible_upstream::Extractor::builder;
  }
}
