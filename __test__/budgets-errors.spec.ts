import test from 'ava'
import { readFileSync } from 'node:fs'

import { extract, extractAsync } from '../index.js'
import type { LegibleError, ResourceLimit } from '../index.js'

const article = readFileSync(new URL('./fixtures/article.html', import.meta.url), 'utf8')
const jsonLd = `<!doctype html><html><head><script type="application/ld+json">[
  {"@context":"https://schema.org","@type":"Article","headline":"One"},
  {"@context":"https://schema.org","@type":"Article","headline":"Two"}
]</script></head><body><main><p>Useful page content remains available for extraction.</p></main></body></html>`
const deepJsonLd = `<script type="application/ld+json">${'['.repeat(4)}{"@type":"Article"}${']'.repeat(4)}</script><main><p>Useful page content.</p></main>`
const parserFixtures = {
  maxInputBytes: article,
  maxNodes: '<main><p>Useful page content.</p></main>',
  maxElements: '<main><p>Useful page content.</p></main>',
  maxTotalAttributes: '<main id="main"><p title="title">Useful page content.</p></main>',
  maxAttributesPerElement: '<main id="main" class="content"><p>Useful page content.</p></main>',
  maxTextBytes: '<main><p>Useful page content.</p></main>',
  maxDepth: '<main><div><p>Useful page content.</p></div></main>',
} as const

type ErrorView = LegibleError & { message: string }

function assertLegibleError(error: unknown, code: string): asserts error is ErrorView {
  if (!(error instanceof Error)) throw new Error('expected an Error')
  if (error.name !== 'LegibleError') throw new Error(`unexpected name: ${error.name}`)
  if ((error as ErrorView).code !== code) throw new Error(`unexpected code: ${(error as ErrorView).code}`)
}

function assertResource(error: unknown, resource: ResourceLimit, limit: number) {
  assertLegibleError(error, 'ERR_LEGIBLE_RESOURCE_LIMIT')
  if (error.resource !== resource) throw new Error(`unexpected resource: ${error.resource}`)
  if (error.limit !== limit) throw new Error(`unexpected limit: ${error.limit}`)
  if (error.observed !== undefined) throw new Error('resource errors must not invent observed values')
}

test('every parser budget field maps to its stable resource error', (t) => {
  const cases: Array<[keyof typeof parserFixtures, ResourceLimit]> = [
    ['maxInputBytes', 'input_bytes'],
    ['maxNodes', 'dom_nodes'],
    ['maxElements', 'elements'],
    ['maxTotalAttributes', 'total_attributes'],
    ['maxAttributesPerElement', 'attributes_per_element'],
    ['maxTextBytes', 'text_bytes'],
    ['maxDepth', 'element_depth'],
  ]

  for (const [field, resource] of cases) {
    const error = t.throws(() => extract(parserFixtures[field], { parseBudget: { [field]: 1 } }))
    if (field === 'maxElements') {
      assertLegibleError(error, 'ERR_LEGIBLE_TOO_MANY_ELEMENTS')
      t.is(error.resource, 'elements')
      t.is(error.limit, 1)
      t.true(typeof error.observed === 'number')
    } else {
      assertResource(error, resource, 1)
    }
  }
})

test('JSON-LD byte, item, and depth budgets map to resource errors', (t) => {
  const cases: Array<[string, string, ResourceLimit]> = [
    ['maxJsonLdBytes', jsonLd, 'json_ld_bytes'],
    ['maxJsonLdItems', jsonLd, 'json_ld_items'],
    ['maxJsonLdDepth', deepJsonLd, 'json_ld_depth'],
  ]
  const limits = { maxJsonLdBytes: 8, maxJsonLdItems: 1, maxJsonLdDepth: 2 }

  for (const [field, html, resource] of cases) {
    const error = t.throws(() => extract(html, { parseBudget: { [field]: limits[field as keyof typeof limits] } }))
    assertResource(error, resource, limits[field as keyof typeof limits])
  }
})

test('zero budgets preserve the unlimited default behavior', (t) => {
  const page = extract(article, {
    parseBudget: {
      maxInputBytes: 0,
      maxNodes: 0,
      maxElements: 0,
      maxTotalAttributes: 0,
      maxAttributesPerElement: 0,
      maxTextBytes: 0,
      maxDepth: 0,
      maxJsonLdBytes: 0,
      maxJsonLdItems: 0,
      maxJsonLdDepth: 0,
    },
  })
  t.true(page.text().length > 0)
})

test('all extraction domain errors use LegibleError codes', (t) => {
  const cases = [
    [() => extract('<html><body></body></html>'), 'ERR_LEGIBLE_NO_CONTENT'],
    [() => extract(article, { url: 'relative' }), 'ERR_LEGIBLE_INVALID_URL'],
    [() => extract(article, { contentRoot: { type: 'id', value: 'missing' } }), 'ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND'],
  ] as const

  for (const [run, code] of cases) {
    const error = t.throws(run)
    assertLegibleError(error, code)
    t.true(error.message.length > 0)
  }
})

test('async budget errors preserve the same structured fields as sync errors', async (t) => {
  const sync = t.throws(() => extract(jsonLd, { parseBudget: { maxJsonLdItems: 1 } }))
  const asyncError = await t.throwsAsync(extractAsync(jsonLd, { parseBudget: { maxJsonLdItems: 1 } }))
  assertResource(sync, 'json_ld_items', 1)
  assertResource(asyncError, 'json_ld_items', 1)
  t.is(asyncError.message, sync.message)
})

test('invalid boundary values and selectors are argument errors, not Legible errors', (t) => {
  const invalidRuns = [
    () => extract(article, { parseBudget: { maxNodes: -1 } }),
    () => extract(article, { parseBudget: { maxNodes: 1.5 } }),
    () => extract(article, { parseBudget: { maxNodes: Number.NaN } }),
    () => extract(article, { parseBudget: { maxNodes: Number.POSITIVE_INFINITY } }),
    () => extract(article, { parseBudget: { maxNodes: Number.MAX_SAFE_INTEGER + 1 } }),
    () => extract(article, { contentRoot: { type: 'id', value: '' } }),
    () => extract(article, { contentRoot: { type: 'class', value: 'two classes' } }),
  ]

  for (const run of invalidRuns) {
    const error = t.throws(run)
    t.not((error as Partial<LegibleError>).name, 'LegibleError')
    t.true(error instanceof Error)
  }
})
