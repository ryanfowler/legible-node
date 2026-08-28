# Development and release notes

This document describes the maintainer workflow for `@ryanfowler/legible`.
The package is a native binding, so source revisions, lockfiles, generated
declarations, and release artifacts must stay reproducible.

## Upstream Legible revision

The current upstream revision is the `rev` value for `legible_upstream` in
[`Cargo.toml`](../Cargo.toml). Confirm it with:

```bash
cargo metadata --format-version 1 \
  | node -e "let data=''; process.stdin.on('data', c => data += c).on('end', () => { const package = JSON.parse(data).packages.find(p => p.source?.startsWith('git+https://github.com/ryanfowler/legible')); console.log(package?.source ?? 'upstream package not found') })"
```

For a simpler source check:

```bash
rg 'legible_upstream|rev =' Cargo.toml
```

The README must contain the same full commit SHA and link to that commit in
the upstream repository.

### Updating upstream deliberately

Never change the dependency to `branch = "main"` or to a crates.io version.
Treat an upstream update as a separate reviewed change:

1. Choose and record the new upstream `main` commit SHA.
2. Change `rev` in `Cargo.toml` and update `Cargo.lock` with `cargo update`.
3. Run `cargo tree` and confirm that the dependency source is the intended Git
   revision.
4. Run the Rust compile-time API and `Send` assertions.
5. Run the full Rust and Node test suites, including diagnostics, error,
   budget, async, worker, and packed-package tests.
6. Check all upstream `#[non_exhaustive]` enums used by the conversion layer.
   New variants must be mapped explicitly; do not add an `unknown` fallback.
7. Review metadata, metrics, diagnostics, canonical HTML behavior, and
   structured-data behavior for user-visible changes.
8. Update the SHA and link in `README.md`.
9. Record the old and new SHAs in the release notes or pull request.

A future revision must not merge until an explicit review confirms the public
Node API still matches the generated declarations and this documentation.

### Inspecting and proposing an update

Print the exact revision used by the checkout with:

```bash
pnpm upstream:revision
```

Check that the revision is synchronized in `Cargo.toml`, `Cargo.lock`, and the
README with:

```bash
pnpm upstream:check
```

The **Propose upstream Legible update** GitHub Actions workflow is manual. Run
it from the repository's Actions page to resolve the current upstream `main`
commit, or provide an exact commit SHA. It creates an isolated
`upstream-update-*` topic branch and opens a pull request; it never changes
`main`, a release branch, or the dependency revision in place. The workflow
updates `Cargo.lock`, runs the complete Rust and Node validation suite, and
includes the old and new SHAs in the pull request. Maintainers must review the
source/API diff, generated declarations, and non-exhaustive enum conversions
before merging. The workflow also dispatches CI for the proposal branch and
waits for that run to pass; this is the final blocking check even when a
repository token policy prevents a pull request event from starting CI.

The workflow derives the `cargo update -p` package selector from the current
lockfile, so an upstream package-version change does not require a workflow
edit. Do not use this workflow to update an immutable release commit.

## Local validation

Use the project toolchain and lockfiles when possible:

```bash
corepack enable
pnpm install
pnpm format
pnpm lint
cargo test
pnpm build
pnpm test
pnpm test:bun
```

`pnpm build` regenerates the native loader and TypeScript declarations. The
build must leave `index.d.ts` unchanged after the declaration checks complete.
Run `pnpm test:dts` when changing Rust annotations or public TypeScript types.

For a release-style package check, collect every target artifact first. The
release workflow uses this sequence after its build jobs upload the binaries:

```bash
pnpm napi create-npm-dirs
pnpm artifacts
pnpm verify:artifacts
pnpm verify:package
```

`pnpm artifacts` expects the complete build output in `artifacts/`. The
verification command packs the root and every platform package, then
install-tests the root package and host platform package in a temporary clean
project. It does not publish anything. The release workflow repeats this check
with `--include-optional` after `napi pre-publish` has prepared the root
optional dependencies. A normal `pnpm test` covers the host binary without
requiring the full release artifact set.

## Release checklist

Releases are made from `main` by the CI workflow. Configure the `NPM_TOKEN`
repository secret before the first release. The workflow enables npm
provenance. Stable versions use the `latest` tag; prereleases use `next`.
Before creating a release commit:

1. Confirm the working tree contains only intended changes.
2. Confirm `Cargo.lock` and `pnpm-lock.yaml` are committed.
3. Confirm `package.json` and the release version agree.
4. Confirm `napi.targets` lists only runtime-tested platforms.
5. Run the complete validation commands above.
6. Run `pnpm verify:release` to validate the package manifest, generated
   loader, pinned upstream revision, and target matrix.
7. Create the version commit with `npm version <newversion>` (or an
   equivalent version command). The release commit subject must be exactly
   `v<version>` or `<version>` because CI uses that subject to recognize a
   release.
8. Push the commit to `main` with `git push origin main`.

The release workflow first runs
`pnpm verify:release -- --require-release-commit`. This check is local and
does not contact npm. It rejects a release if the generated loader, package
metadata, pinned upstream revision, or target matrix is inconsistent.

Release builds disable incremental compilation. The MSVC linker also runs with
`/Brepro`. These settings keep native artifacts byte-for-byte stable when a
failed publication is retried.

The release workflow then performs these steps:

1. Builds every configured target.
2. Runs the host and cross-target tests on Node.js 22 and 24, plus the Bun
   1.4.0 Linux x64 smoke test.
3. Runs `napi create-npm-dirs` and `napi artifacts`.
4. Runs `pnpm verify:artifacts`, which requires exactly one complete binary
   for every configured target.
5. Packs the root and every platform package, then install-tests the root
   package and the host platform package before registry writes.
6. Publishes platform packages first.
7. Verifies every platform package in the registry, including integrity and
   required npm provenance.
8. Publishes the root package last.
9. Verifies the complete optional-dependency graph and creates the GitHub
   release.

The root package must never be published before all platform packages pass
registry verification. Do not run `npm publish` manually as a substitute for
this workflow.

### First prerelease and stable release

Use a prerelease to validate the public package graph before the first stable
release. From a clean `main` checkout, run the complete local checks, then
update the version without creating a commit with
`npm version --ignore-scripts --no-git-tag-version 0.1.0-rc.0` (or use the next
unused prerelease version). Run `pnpm build`, `pnpm test`, and
`pnpm verify:release`, then commit the version and generated loader with the
subject `v0.1.0-rc.0`. Push the release commit to `main`, and install the
`next` package from a clean project on each blocking platform.
Check CommonJS, ESM, async extraction, and a clean TypeScript compilation.

If a platform package or loader is wrong, publish a new prerelease version;
npm versions are immutable. Do not reuse the broken version. When the full matrix passes, update the version with
`npm version --ignore-scripts --no-git-tag-version 0.1.0`, run `pnpm build`,
`pnpm test`, and `pnpm verify:release` again, then commit the generated loader
with subject `v0.1.0` and push that release commit. The workflow publishes the `latest` tag only after all
platform packages pass their exact-artifact, registry-integrity, and
provenance checks.

## Recovery after a partial publication

npm package versions are immutable. If a release stops after publishing some
platform packages:

1. Stop the workflow and inventory the exact package/version pairs already in
   the registry.
2. Keep the original build artifacts. Do not rebuild different binaries for
   the same version.
3. Restore the unchanged artifact files, recreate the package directories,
   and collect them without rebuilding. Generated directories use identities
   such as `npm/linux-x64-gnu`, `npm/linux-x64-musl`, and
   `npm/win32-x64-msvc`:

   ```bash
   pnpm napi create-npm-dirs
   pnpm artifacts
   pnpm verify:artifacts
   pnpm napi pre-publish --tag-style npm --root-publisher npm \
     --skip-optional-publish --no-gh-release
   node scripts/verify-package.mjs --include-optional
   ```

   The `napi pre-publish` command above prepares the root
   `optionalDependencies` and target manifests without publishing. The
   generated root dependencies are not in `pnpm-lock.yaml`, so run the
   post-publish checks through `node` until the source manifest is restored.
   The `--include-optional` package check confirms that the root can select a
   platform package. `pnpm artifacts` expects the original files in
   `artifacts/`; do not create replacement binaries for an immutable version.

4. Configure npm authentication and provenance as for a normal release. For
   each missing generated directory, such as `npm/linux-x64-gnu`, confirm that
   its package/version is absent, then run this command from that directory:

   ```bash
   tag=latest # use next for a prerelease
   npm publish --ignore-scripts --provenance --access public --tag "$tag"
   ```

   Do not rerun a command that republishes packages already in the registry.
   The commands below use `latest` for a stable release; substitute `next`
   for a prerelease.

5. Run platform-only verification:

   ```bash
   node scripts/verify-registry.mjs --platforms-only --require-provenance --tag latest
   ```

6. From the repository root, publish the root package only after that
   verification succeeds:

   ```bash
   npm publish --ignore-scripts --provenance --access public --tag latest
   ```

If the root package was published with a missing platform package, repair the
missing package immediately if possible. Otherwise deprecate the broken root
version and release a new version.

## Support policy

Advertise only targets that have a blocking runtime smoke test. Node.js 22 and
24, and Bun 1.4.0 or newer, are supported runtime versions. The package engine
permits newer Node.js versions, but Node.js 26 is only a forward-compatibility
check and is not part of the current support contract. Bun support is currently
verified on Linux x64. Do not add Windows arm64, Deno, WASI, or another runtime
or target to the support statement without a separate runtime test and an
explicit documentation update.
