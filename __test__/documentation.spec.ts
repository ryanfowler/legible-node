import test from 'ava'

import { readFileSync } from 'node:fs'

import { extract } from '../index.js'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const declarations = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  napi: { targets: string[] }
}
const ci = readFileSync(new URL('../.github/workflows/CI.yml', import.meta.url), 'utf8')
const development = readFileSync(new URL('../docs/development.md', import.meta.url), 'utf8')
const cargo = readFileSync(new URL('../Cargo.toml', import.meta.url), 'utf8')
const cargoLock = readFileSync(new URL('../Cargo.lock', import.meta.url), 'utf8')

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
  'extractAsync',
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
  t.true(readme.includes('platform packages are published'))

  for (const target of packageJson.napi.targets) t.true(readme.includes(`\`${target}\``), target)
})

test('README selector example is executable with its documented HTML', (t) => {
  const html = '<article id="main-article" class="article-body"><h1>An article</h1><p>Useful content.</p></article>'
  const page = extract(html, {
    contentHint: { type: 'class', value: 'article-body' },
    contentRoot: { type: 'id', value: 'main-article' },
  })

  t.true(readme.includes(html))
  t.true(page.markdown().includes('Useful content.'))
})

test('developer notes document the pinned revision and safe release order', (t) => {
  t.true(development.includes('Updating upstream deliberately'))
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
  ]) {
    t.true(development.includes(term), term)
  }

  const platformPublication = ci.indexOf('Publish platform packages')
  const platformVerification = ci.indexOf('Verify platform packages before publishing the root')
  const rootPublication = ci.indexOf('Publish root package last')
  t.true(platformPublication >= 0)
  t.true(platformVerification > platformPublication)
  t.true(rootPublication > platformVerification)
})
