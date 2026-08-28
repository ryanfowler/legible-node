import test from 'ava'

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { extractSync } from '../index.js'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const declarations = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  engines: { bun: string }
  napi: { targets: string[] }
}
const ci = readFileSync(new URL('../.github/workflows/CI.yml', import.meta.url), 'utf8')
const development = readFileSync(new URL('../docs/development.md', import.meta.url), 'utf8')
const cargo = readFileSync(new URL('../Cargo.toml', import.meta.url), 'utf8')
const cargoLock = readFileSync(new URL('../Cargo.lock', import.meta.url), 'utf8')
const releaseScript = readFileSync(new URL('../scripts/verify-release.mjs', import.meta.url), 'utf8')
const upstreamRevisionScript = readFileSync(new URL('../scripts/upstream-revision.mjs', import.meta.url), 'utf8')
const upstreamUpdateWorkflow = readFileSync(
  new URL('../.github/workflows/upstream-update.yml', import.meta.url),
  'utf8',
)

const requiredReadmeSections = [
  '## Requirements and support',
  '## Installation',
  '### Synchronous extraction',
  '### Asynchronous extraction',
  '### Fetching HTML',
  '## Reusable extractors',
  '### Markdown',
  '### Content selectors',
  '### Resource budgets for untrusted input',
  '### Structured data',
  '### Diagnostics',
  '## Result API',
  '## Errors',
  '## Development',
]

const publicApiTerms = [
  'extract',
  'extractSync',
  'Extractor',
  'ExtractedPage',
  'metadata',
  'metrics',
  'diagnostics',
  'metadataDiagnostics',
  'structuredData',
  'markdown',
  'text()',
  'html()',
  'parseBudget',
  'contentHint',
  'contentRoot',
  'maxLineWidth',
  'links',
  'images',
  'maxInputBytes',
  'maxNodes',
  'maxElements',
  'maxTotalAttributes',
  'maxAttributesPerElement',
  'maxTextBytes',
  'maxDepth',
  'maxJsonLdBytes',
  'maxJsonLdItems',
  'maxJsonLdDepth',
  'ERR_LEGIBLE_INVALID_URL',
  'ERR_LEGIBLE_NO_BODY',
  'ERR_LEGIBLE_NO_CONTENT',
  'ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND',
  'ERR_LEGIBLE_TOO_MANY_ELEMENTS',
  'ERR_LEGIBLE_RESOURCE_LIMIT',
  'ERR_LEGIBLE_PARSE',
  'ERR_LEGIBLE_BINDING_INCOMPATIBLE',
]

test('README documents the supported public workflow', (t) => {
  for (const term of publicApiTerms) {
    t.true(readme.includes(term), `README is missing ${term}`)
    t.true(declarations.includes(term), `declarations are missing ${term}`)
  }
  for (const section of requiredReadmeSections) t.true(readme.includes(section), section)

  const upstreamRevision = cargo.match(/legible_upstream[\s\S]*?rev\s*=\s*"([0-9a-f]{40})"/)?.[1]
  t.truthy(upstreamRevision)
  const revision = upstreamRevision as string
  t.true(readme.includes(revision))
  t.true(readme.includes(`https://github.com/ryanfowler/legible/tree/${revision}`))
  t.true(cargoLock.includes(`?rev=${revision}#${revision}`))
  t.true(readme.includes('does not fetch pages'))
  t.true(readme.includes('does not use Tokio'))
  t.true(readme.includes('example policy, not a'))
  t.true(readme.includes('Bun 1.4.0 and newer'))
  t.true(readme.includes('bun add @ryanfowler/legible'))
  t.true(ci.includes('test-bun-binding'))
  t.is(packageJson.engines.bun, '>=1.4.0')
  t.true(readme.includes('platform packages are published'))

  for (const target of packageJson.napi.targets) t.true(readme.includes(`\`${target}\``), target)
})

test('the upstream revision commands report a synchronized local pin', (t) => {
  const script = fileURLToPath(new URL('../scripts/upstream-revision.mjs', import.meta.url))
  const revision = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' }).trim()
  t.true(/^[0-9a-f]{40}$/.test(revision))
  t.is(execFileSync(process.execPath, [script], { encoding: 'utf8' }).trim(), revision)
})

test('README selector example is executable with its documented HTML', (t) => {
  const html = '<article id="main-article" class="article-body"><h1>An article</h1><p>Useful content.</p></article>'
  const page = extractSync(html, {
    contentHint: { type: 'class', value: 'article-body' },
    contentRoot: { type: 'id', value: 'main-article' },
  })

  t.true(readme.includes(html))
  t.true(page.markdown().includes('Useful content.'))
})

test('developer notes document the pinned revision and safe release order', (t) => {
  t.true(development.includes('Updating upstream deliberately'))
  t.true(development.includes('pnpm upstream:revision'))
  t.true(development.includes('pnpm upstream:check'))
  t.true(development.includes('upstream-update-*'))
  t.true(upstreamRevisionScript.includes('readPinnedRevision'))
  t.true(upstreamRevisionScript.includes('Cargo.lock'))
  t.true(upstreamUpdateWorkflow.includes('workflow_dispatch'))
  t.true(upstreamUpdateWorkflow.includes('cargo test --locked'))
  t.true(upstreamUpdateWorkflow.includes('pnpm test'))
  t.true(upstreamUpdateWorkflow.includes('pnpm test:bun'))
  t.true(upstreamUpdateWorkflow.includes('pnpm exec ava __test__/package.spec.ts'))
  t.true(upstreamUpdateWorkflow.includes('git diff --cached --name-only'))
  t.true(upstreamUpdateWorkflow.includes('persist-credentials: false'))
  t.true(upstreamUpdateWorkflow.includes('actions: write'))
  t.true(upstreamUpdateWorkflow.includes('never merges'))
  t.true(development.includes('Never change the dependency to `branch = "main"`'))
  t.true(development.includes('Publishes platform packages first.'))
  t.true(development.includes('Publishes the root package last.'))
  t.true(development.includes('Do not rebuild different binaries'))
  for (const term of [
    'npm version <newversion>',
    'git push origin main',
    'NPM_TOKEN',
    '--skip-optional-publish',
    '--include-optional',
    '--platforms-only',
    '--require-provenance',
    'npm publish --ignore-scripts',
    'npm/linux-x64-gnu',
    'pnpm verify:release',
    '0.1.0-rc.0',
    'npm versions are immutable',
  ]) {
    t.true(development.includes(term), term)
  }

  const platformPublication = ci.indexOf('Publish platform packages')
  const platformVerification = ci.indexOf('Verify platform packages before publishing the root')
  const rootPublication = ci.indexOf('Publish root package last')
  t.true(platformPublication >= 0)
  t.true(platformVerification > platformPublication)
  t.true(rootPublication > platformVerification)
  t.true(releaseScript.includes('requireReleaseCommit'))
  t.true(releaseScript.includes('Bun engine must be >=1.4.0'))
  t.true(releaseScript.includes('consumer install hook'))
})
