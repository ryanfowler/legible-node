use std::{env, fs, hint::black_box, path::PathBuf, time::Instant};

const DEFAULT_ITERATIONS: usize = 20;

fn iterations() -> usize {
  match env::var("RUST_BENCH_ITERATIONS") {
    Ok(value) => {
      let parsed = value
        .parse::<usize>()
        .unwrap_or_else(|_| panic!("RUST_BENCH_ITERATIONS must be a positive integer"));
      if parsed == 0 {
        panic!("RUST_BENCH_ITERATIONS must be a positive integer");
      }
      parsed
    }
    Err(_) => DEFAULT_ITERATIONS,
  }
}

fn measure(iterations: usize, mut operation: impl FnMut()) -> f64 {
  // Match Tinybench's warmup so one-time initialization and lazy caches do not
  // distort the comparison rows.
  operation();
  let start = Instant::now();
  for _ in 0..iterations {
    operation();
  }
  start.elapsed().as_secs_f64() * 1_000.0 / iterations as f64
}

fn main() {
  let fixture_dir = env::args()
    .nth(1)
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("benchmark/fixtures"));
  let manifest = fs::read_to_string(fixture_dir.join("manifest.txt")).unwrap_or_else(|error| {
    panic!(
      "failed to read {}: {error}",
      fixture_dir.join("manifest.txt").display()
    )
  });
  let paths: Vec<_> = manifest
    .lines()
    .filter(|name| !name.trim().is_empty())
    .map(|name| fixture_dir.join(format!("{}.html", name.trim())))
    .collect();

  let iterations = iterations();
  println!("fixture,bytes,operation,mean_ms,iterations");
  for path in paths {
    let html = fs::read_to_string(&path)
      .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
    let name = path
      .file_stem()
      .and_then(|stem| stem.to_str())
      .unwrap_or("fixture");
    let bytes = html.len();

    let extraction = measure(iterations, || {
      let page = legible_upstream::extract(black_box(&html), None).expect("extraction failed");
      black_box(page);
    });
    let extraction_markdown = measure(iterations, || {
      let page = legible_upstream::extract(black_box(&html), None).expect("extraction failed");
      black_box(page.markdown());
    });
    let extraction_text = measure(iterations, || {
      let page = legible_upstream::extract(black_box(&html), None).expect("extraction failed");
      black_box(page.text());
    });
    let extraction_html = measure(iterations, || {
      let page = legible_upstream::extract(black_box(&html), None).expect("extraction failed");
      black_box(page.html());
    });
    let extraction_all = measure(iterations, || {
      let page = legible_upstream::extract(black_box(&html), None).expect("extraction failed");
      black_box(page.markdown());
      black_box(page.text());
      black_box(page.html());
    });

    let page = legible_upstream::extract(&html, None).expect("extraction failed");
    let render_markdown = measure(iterations, || {
      black_box(page.markdown());
    });
    let render_text = measure(iterations, || {
      black_box(page.text());
    });
    let render_html = measure(iterations, || {
      black_box(page.html());
    });
    let render_all = measure(iterations, || {
      black_box(page.markdown());
      black_box(page.text());
      black_box(page.html());
    });

    for (operation, mean) in [
      ("extraction", extraction),
      ("extraction + Markdown", extraction_markdown),
      ("extraction + text", extraction_text),
      ("extraction + HTML", extraction_html),
      ("extraction + all formats", extraction_all),
      ("render-only Markdown (warm)", render_markdown),
      ("render-only text (warm)", render_text),
      ("render-only HTML (warm)", render_html),
      ("render-only all formats (warm)", render_all),
    ] {
      println!("{name},{bytes},{operation},{mean:.6},{iterations}");
    }
  }
}
