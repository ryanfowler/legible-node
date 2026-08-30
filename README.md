# `@ryanfowler/legible`

Fast readable-content extraction for Node.js and Bun, powered by the [Legible
Rust crate](https://github.com/ryanfowler/legible). This package is a thin
Node-API binding built with napi-rs. Extraction remains in Rust; JavaScript
receives a native-backed page that renders its semantic content lazily.

## Requirements and support

- Node.js 22 and 24 are supported in blocking CI checks. Node.js 26 has a
  non-blocking forward-compatibility check.
- Bun 1.4.0 and newer are supported in a blocking Linux x64 native-binding
  smoke test.
- Prebuilt binaries are published for macOS x64 and arm64, Linux x64 and
  arm64 with glibc, Linux x64 and arm64 with musl, and Windows x64 (MSVC).
- The package does not require Rust, a C/C++ compiler, `node-gyp`, or an
  install-time binary downloader.

Supported native targets are:

| Platform            | Target                       |
| ------------------- | ---------------------------- |
| macOS x64           | `x86_64-apple-darwin`        |
| macOS arm64         | `aarch64-apple-darwin`       |
| Linux x64 (glibc)   | `x86_64-unknown-linux-gnu`   |
| Linux arm64 (glibc) | `aarch64-unknown-linux-gnu`  |
| Linux x64 (musl)    | `x86_64-unknown-linux-musl`  |
| Linux arm64 (musl)  | `aarch64-unknown-linux-musl` |
| Windows x64 (MSVC)  | `x86_64-pc-windows-msvc`     |

The current binding uses Legible revision
[`363046a74661097f9fe252008eb62ea5e7370df5`](https://github.com/ryanfowler/legible/tree/363046a74661097f9fe252008eb62ea5e7370df5).
The revision is pinned in `Cargo.toml` and `Cargo.lock`.

## Installation

```bash
npm install @ryanfowler/legible
# or: pnpm add @ryanfowler/legible
# or: bun add @ryanfowler/legible
```

## Quick start

### Asynchronous extraction

Use `extract` for CPU-heavy documents in a server or other event-loop sensitive
application. It runs extraction in napi-rs's libuv worker pool.

```ts
import { extract } from '@ryanfowler/legible'

const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = await extract(html, {
  url: 'https://example.com/article',
})

console.log(page.metadata.title)
console.log(page.markdown())
```

Request one or more rendered formats as part of extraction. Markdown accepts
the same rendering options as `page.markdown(options)`:

```ts
const page = await extract(html, {
  url: 'https://example.com/article',
  output: {
    markdown: { links: false, images: false, maxLineWidth: 100 },
    html: true,
    text: true,
  },
})

console.log(page.output)
// { markdown: string, html: string, text: string }

console.log(JSON.stringify(page)) // Includes the requested output strings.
```

The returned `ExtractedPage` keeps the native semantic representation. Its
`markdown()`, `text()`, and `html()` methods render only when called. The
`metadata`, `metrics`, diagnostics, and structured-data getters return fresh
JavaScript values.

`extract` does not use Tokio. It schedules CPU work asynchronously without
blocking the calling JavaScript thread, so cap concurrent extractions in
high-throughput services. On Node.js, use Worker Threads when extraction must
be isolated from other libuv worker-pool work.

An `AbortSignal` can cancel a task while it is queued. It cannot interrupt the
native callback after extraction starts.

```ts
const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const controller = new AbortController()
const pending = extract(html, { signal: controller.signal })
controller.abort() // Cancels only if the native task has not started.
try {
  await pending
} catch (error) {
  if (!(error instanceof Error) || error.name !== 'AbortError') throw error
}
```

### Synchronous extraction

Use `extractSync` for small documents, scripts, CLIs, and code that already runs
in a Worker Thread. It runs on the calling thread and blocks it while
extracting.

```ts
import { extractSync } from '@ryanfowler/legible'

const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = extractSync(html, { url: 'https://example.com/article' })

console.log(page.markdown())
```

### Fetching HTML

This package extracts supplied HTML. It does not fetch pages, follow
redirects, or execute JavaScript. Fetch the page in the application and pass
the final response URL so relative links and media resolve correctly.

```ts
import { extract } from '@ryanfowler/legible'

const requestedUrl = 'https://example.com/article'
const response = await fetch(requestedUrl)
if (!response.ok) throw new Error(`HTTP ${response.status}`)

const page = await extract(await response.text(), {
  url: response.url,
})
console.log(page.markdown())
```

For a JavaScript-rendered page, use a browser tool such as Playwright in the
application, then pass its serialized HTML and URL to this package. Playwright
is not a dependency of `@ryanfowler/legible`.

## Reusable extractors

`Extractor` builds an immutable configuration once. Call-level options contain
only the source URL (and, for async calls, an `AbortSignal`).

```ts
import { Extractor } from '@ryanfowler/legible'

const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const extractor = new Extractor({
  structuredData: true,
  diagnostics: false,
  parseBudget: {
    maxInputBytes: 5_000_000,
    maxNodes: 100_000,
  },
})

const page = await extractor.extract(html, {
  url: 'https://example.com/article',
})
```

The one-shot functions accept the same extractor options together with `url`:

```ts
const html = '<article id="main-article" class="article-body"><h1>An article</h1><p>Useful content.</p></article>'
const page = extractSync(html, {
  contentHint: { type: 'tag', value: 'article' },
  url: 'https://example.com/article',
})
```

One-shot and reusable calls accept an `output` object. Set `html` or `text` to
`true`. Set `markdown` to `true` for the defaults or supply a `MarkdownOptions`
object. The returned page includes the requested strings in `page.output`.
Unrequested fields are `null`. `page.output` is `null` when the call omits the
`output` option. Async calls extract and render on the libuv worker pool.
`JSON.stringify(page)` serializes the page metadata, metrics, diagnostics,
structured data, and requested output strings.

## Options

All numeric limits use JavaScript `number` values. They must be non-negative,
finite integers no greater than `Number.MAX_SAFE_INTEGER`. Zero means no
caller-configured limit, following Legible's behavior.

Unless specified otherwise, `structuredData` defaults to `true`.
`diagnostics`, `metadataDiagnostics`, and `retainStructuredData` default to
`false`. `contentHint` and `contentRoot` are unset by default.

### Markdown

`page.markdown(options?)` supports:

| Option         | Default     | Description                                               |
| -------------- | ----------- | --------------------------------------------------------- |
| `links`        | `true`      | Render links. Set to `false` to keep link text only.      |
| `images`       | `true`      | Render images. Set to `false` to omit them.               |
| `maxLineWidth` | no wrapping | Preferred prose source-line width. `0` disables wrapping. |

```ts
const markdown = page.markdown({
  links: false,
  images: false,
  maxLineWidth: 100,
})
```

### Content selectors

`contentHint` adds evidence while normal quality checks remain active.
`contentRoot` selects the first matching element as the exact extraction root
and fails if it is missing. Selectors are typed; arbitrary CSS selectors are
not accepted.

```ts
const page = extractSync(html, {
  contentHint: { type: 'class', value: 'article-body' },
  contentRoot: { type: 'id', value: 'main-article' },
})

// Supported tag values: 'article', 'main', 'section', and 'div'.
const byTag = extractSync(html, {
  contentRoot: { type: 'tag', value: 'article' },
})
```

An ID must not be empty. A class must be one class token and must not contain
whitespace. The `url` option must be an absolute URL when supplied.

### Resource budgets for untrusted input

Legible does not impose a wrapper-specific default budget. Set an application
policy when the input is untrusted. The following is an example policy, not a
package default or a universal recommendation:

```ts
const extractor = new Extractor({
  parseBudget: {
    maxInputBytes: 5_000_000,
    maxNodes: 100_000,
    maxElements: 75_000,
    maxTotalAttributes: 250_000,
    maxAttributesPerElement: 100,
    maxTextBytes: 4_000_000,
    maxDepth: 256,
    maxJsonLdBytes: 1_000_000,
    maxJsonLdItems: 10_000,
    maxJsonLdDepth: 128,
  },
})
```

The budget fields are `maxInputBytes`, `maxNodes`, `maxElements`,
`maxTotalAttributes`, `maxAttributesPerElement`, `maxTextBytes`, `maxDepth`,
`maxJsonLdBytes`, `maxJsonLdItems`, and `maxJsonLdDepth`. A zero
`maxJsonLdDepth` uses Legible's internal safety cap. A non-zero value above that
cap is limited to the same internal cap.

### Structured data

`structuredData` controls whether JSON-LD participates in extraction and
metadata decisions. `retainStructuredData` independently controls whether
parsed schema.org items remain available on the result:

```ts
const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = extractSync(html, {
  structuredData: true,
  retainStructuredData: true,
})

// [] means retention was enabled but no items were retained.
// null means retention was disabled.
console.log(page.structuredData)
```

Retained items are JavaScript values (`unknown[]`), not JSON strings.

### Diagnostics

Diagnostics are opt-in because they retain and convert additional detail:

```ts
const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = extractSync(html, {
  diagnostics: true,
  metadataDiagnostics: true,
})

console.log(page.diagnostics?.selectedStrategy)
console.log(page.diagnostics?.attempts)
console.log(page.metadataDiagnostics?.title.selected)
```

With the flags disabled, the corresponding getters return `null`. Extraction
diagnostics describe the selected strategy, attempts, roots, source/result
metrics, quality, semantic coverage, cleanup, normalization, representation,
and acceptance. Metadata diagnostics describe selected and alternative values,
provenance sources, and confidence. Diagnostic enum values are camelCase
strings; resource-limit names use their stable snake_case names. Optional
values are `null`.

## Result API

`ExtractedPage` cannot be constructed directly. It exposes:

- `metadata`: `title`, `description`, `authors`, `siteName`, `canonicalUrl`,
  `image`, `favicon`, `publishedTime`, `modifiedTime`, `language`, `direction`,
  `section`, and `tags`. Missing scalar values are `null`; list values are
  always arrays.
- `metrics`: word count, text and link lengths, link density, paragraph,
  heading, list, code, table, figure, image, footnote, math, and structured
  block counts, plus text-character and contextual-structure measurements.
- `diagnostics`: extraction decision details or `null`.
- `metadataDiagnostics`: metadata provenance details or `null`.
- `structuredData`: retained JSON-LD items or `null`.
- `output`: requested Markdown, HTML, and text strings, or `null`.
- `toJSON()`: the structured value used by `JSON.stringify(page)`.
- `markdown(options?)`: canonical Markdown.
- `text()`: normalized plain text.
- `html()`: canonical semantic HTML.

See [`index.d.ts`](./index.d.ts) for the complete TypeScript declarations,
including every diagnostic record and string union.

The canonical semantic HTML is safe-by-construction output from the pinned
Legible revision, not arbitrary source markup. Legible is not an
application-wide Content Security Policy. If an application transforms or
combines this output with other untrusted HTML, that rendering pipeline still
needs its own security controls. Markdown contains no raw HTML and filters
unsupported destinations according to the canonical representation rules.

## Errors

Domain failures throw or reject with an `Error` whose `name` is
`LegibleError` and whose stable `code` identifies the failure. Limit errors
also include `resource`, `limit`, and, when supplied by Legible, `observed`.
Argument-validation errors (for example, a negative budget, invalid selector,
or invalid Markdown width) are ordinary argument errors instead.

The domain codes are:

- `ERR_LEGIBLE_INVALID_URL`
- `ERR_LEGIBLE_NO_BODY`
- `ERR_LEGIBLE_NO_CONTENT`
- `ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND`
- `ERR_LEGIBLE_TOO_MANY_ELEMENTS`
- `ERR_LEGIBLE_RESOURCE_LIMIT`
- `ERR_LEGIBLE_PARSE`
- `ERR_LEGIBLE_BINDING_INCOMPATIBLE`

```ts
const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const url = 'https://example.com/article'
try {
  const page = await extract(html, { url })
  console.log(page.markdown())
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ERR_LEGIBLE_NO_CONTENT') {
    // The document was valid, but no relevant content was found.
  } else {
    throw error
  }
}
```

Do not identify an error by parsing its human-readable `message`.

## Development

Requirements are Rust, Node.js 22 or newer, and pnpm. Bun 1.4.0 or newer is
required to run the Bun smoke test. Corepack can enable the pinned package
manager:

```bash
corepack enable
pnpm install
pnpm build
pnpm test
pnpm lint
cargo test
```

Run `pnpm bench` for informational Node benchmarks and `pnpm bench:rust` for a
direct Rust comparison. `pnpm bench:memory` exercises result creation and
teardown; it reports trends and does not enforce a fixed memory limit. Set
`BENCH_TIME_MS`, `BENCH_WARMUP_MS`, or `BENCH_ITERATIONS` to tune the Node
benchmark. Set `MEMORY_CYCLES` or `MEMORY_ITERATIONS` to tune the memory
utility.

Before a release, run `pnpm verify:release` to check the generated loader,
package metadata, pinned upstream revision, and complete target matrix. Use an
`rc` prerelease on the `next` tag to validate a clean install before publishing
`0.1.0` on `latest`. The release and upstream-update procedure is documented
in [`docs/development.md`](https://github.com/ryanfowler/legible-node/blob/main/docs/development.md).
Releases use napi-rs's root
package plus one optional package per supported platform. Native artifacts are
validated and install-tested before platform packages are published; the root
package is published last.

## License

`@ryanfowler/legible` is licensed under [Apache-2.0](./LICENSE).
