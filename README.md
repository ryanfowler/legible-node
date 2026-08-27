# `@ryanfowler/legible`

![https://github.com/ryanfowler/legible-node/actions](https://github.com/ryanfowler/legible-node/workflows/CI/badge.svg)

> Fast readable-content extraction for Node.js, powered by the Legible Rust crate.

## Upstream dependency

The native binding is pinned to the reviewed Legible Git revision
[`899356a2540863898b2c9fe639241da606889256`](https://github.com/ryanfowler/legible/tree/899356a2540863898b2c9fe639241da606889256).
This is a later revision than the design snapshot and includes the upstream
fix that makes retained extracted pages sendable for the planned async API.
The revision is recorded directly in `Cargo.toml` and `Cargo.lock` for reproducible builds.

# Usage

1. **Clone** the repository.
2. Run `pnpm install` to install dependencies.

## Install this package

```bash
pnpm add @ryanfowler/legible
```

## API

`extract(html, options?)` performs synchronous extraction and returns an
`ExtractedPage`. The page renders Markdown, text, and canonical HTML lazily.
For CPU-heavy documents, use `extractAsync`; it runs extraction in napi-rs's
libuv worker pool without Tokio:

```ts
import { extractAsync } from '@ryanfowler/legible'

const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = await extractAsync(html, { url: 'https://example.com/article' })
console.log(page.markdown())
```

`new Extractor(options?)` creates an immutable configuration that can be reused:

```ts
import { Extractor } from '@ryanfowler/legible'

const extractor = new Extractor({
  parseBudget: { maxInputBytes: 5_000_000, maxNodes: 100_000 },
})
const html = '<main><h1>An article</h1><p>Useful content.</p></main>'
const page = await extractor.extractAsync(html, { url: 'https://example.com/article' })
```

`signal` accepts an `AbortSignal`. It can cancel a queued task. It cannot
interrupt extraction after native computation starts. Async extraction shares
Node's libuv worker pool, so applications should cap concurrent extractions.
Use Worker Threads when stronger CPU-pool isolation is needed.

The package extracts supplied HTML only. It does not fetch pages or execute
JavaScript. Fetch HTML separately and pass the final response URL as `url`.

## Usage

### Build

After `pnpm build` command, you can see `legible.[darwin|win32|linux].node` file in project root. This is the native addon built from [lib.rs](./src/lib.rs).

### Test

With [ava](https://github.com/avajs/ava), run `pnpm test` to testing native addon. You can also switch to another testing framework if you want.

### CI

With GitHub Actions, each commit and pull request will be built and tested automatically across the configured native targets on Node.js 22.

### Release

Release native package is very difficult in old days. Native packages may ask developers who use it to install `build toolchain` like `gcc/llvm`, `node-gyp` or something more.

With `GitHub actions`, we can easily prebuild a `binary` for major platforms. And with `N-API`, we should never be afraid of **ABI Compatible**.

The other problem is how to deliver prebuild `binary` to users. Downloading it in `postinstall` script is a common way that most packages do it right now. The problem with this solution is it introduced many other packages to download binary that has not been used by `runtime codes`. The other problem is some users may not easily download the binary from `GitHub/CDN` if they are behind a private network (But in most cases, they have a private NPM mirror).

In this package, we choose a better way to solve this problem. We release different `npm packages` for different platforms. And add it to `optionalDependencies` before releasing the `Major` package to npm.

`NPM` will choose which native package should download from `registry` automatically. You can see [npm](./npm) dir for details. And you can also run `pnpm add @ryanfowler/legible` to use the published package.

## Develop requirements

- Install the latest `Rust`
- Install `Node.js@22+` which is supported by this package
- Run `corepack enable`

## Test in local

- pnpm
- pnpm build
- pnpm test

And you will see:

```bash
$ ava --verbose

  ✔ sync function from native code
  ─

  1 test passed
✨  Done in 1.12s.
```

## Release package

Ensure you have set your **NPM_TOKEN** in the `GitHub` project setting.

In `Settings -> Secrets`, add **NPM_TOKEN** into it.

When you want to release the package:

```bash
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]

git push
```

GitHub actions will do the rest job for you.

> WARN: Don't run `npm publish` manually.
