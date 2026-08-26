#![deny(clippy::all)]

// These conversion helpers are consumed by the public API in later binding
// tasks; keep them available and testable while the intermediate scaffold has
// no exported extractor methods yet.
#[allow(dead_code)]
mod numeric;
#[allow(dead_code)]
mod options;

#[cfg(test)]
mod upstream_api_tests {
  fn assert_send<T: Send>() {}
  fn assert_sync<T: Sync>() {}

  #[test]
  fn upstream_page_and_extractor_are_send() {
    // Keep the critical AsyncTask assertion active before implementing it.
    assert_send::<legible_upstream::ExtractedPage>();
    assert_send::<legible_upstream::Extractor>();
  }

  #[test]
  fn upstream_extractor_is_sync() {
    // Extractor configuration is shared by future async tasks. The page is
    // intentionally not asserted Sync: the pinned upstream page contains
    // tendril::Atomic code text, which is Send but not Sync.
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
