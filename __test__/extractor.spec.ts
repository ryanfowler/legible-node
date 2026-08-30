import test from 'ava'

import { ExtractedPage, Extractor, extractSync } from '../index.js'
import type { LegibleError } from '../index.js'

const HTML = `
  <html>
    <head><title>Reusable extraction</title></head>
    <body>
      <main>
        <h1>Reusable extraction</h1>
        <p>This document has enough meaningful text to produce a stable extracted page.</p>
        <p>It includes a <a href="/article">relative article link</a>.</p>
      </main>
    </body>
  </html>
`

test('top-level and reusable sync extraction have behavioral parity', (t) => {
  const url = 'https://example.com/story'
  const options = { diagnostics: true, structuredData: false }
  const oneShot = extractSync(HTML, { ...options, url })
  const reusable = new Extractor(options).extractSync(HTML, { url })

  t.true(oneShot instanceof ExtractedPage)
  t.deepEqual(oneShot.metadata, reusable.metadata)
  t.deepEqual(oneShot.metrics, reusable.metrics)
  t.deepEqual(oneShot.diagnostics, reusable.diagnostics)
  t.is(oneShot.markdown(), reusable.markdown())
  t.is(oneShot.text(), reusable.text())
  t.is(oneShot.html(), reusable.html())
})

test('sync URL options resolve relative links', (t) => {
  const page = extractSync(HTML, { url: 'https://example.com/story' })

  t.true(page.markdown().includes('[relative article link](https://example.com/article)'))
})

test('sync extraction can include all requested outputs', (t) => {
  const markdownOptions = { links: false, images: false, maxLineWidth: 40 }
  const page = extractSync(HTML, {
    url: 'https://example.com/story',
    diagnostics: true,
    metadataDiagnostics: true,
    retainStructuredData: true,
    output: { markdown: markdownOptions, html: true, text: true },
  })
  const reusable = new Extractor().extractSync(HTML, {
    output: { markdown: true },
  })

  t.is(page.output?.markdown, page.markdown(markdownOptions))
  t.is(page.output?.html, page.html())
  t.is(page.output?.text, page.text())
  t.is(reusable.output?.markdown, reusable.markdown())
  t.is(reusable.output?.html, null)
  t.is(reusable.output?.text, null)
  t.is(extractSync(HTML).output, null)

  const json = JSON.parse(JSON.stringify(page)) as ReturnType<typeof page.toJSON>
  t.deepEqual(json, {
    metadata: page.metadata,
    metrics: page.metrics,
    diagnostics: page.diagnostics,
    metadataDiagnostics: page.metadataDiagnostics,
    structuredData: page.structuredData,
    output: page.output,
  })
})

test('output Markdown options use the same validation as page rendering', (t) => {
  const error = t.throws(() =>
    extractSync(HTML, {
      output: { markdown: { maxLineWidth: -1 } },
    }),
  )

  t.true(error.message.includes('maxLineWidth'))
})

test('invalid URLs map to structured Legible errors on both sync paths', (t) => {
  const cases = [
    () => extractSync(HTML, { url: 'relative' }),
    () => new Extractor().extractSync(HTML, { url: 'relative' }),
  ]

  for (const run of cases) {
    const error = t.throws(run) as LegibleError
    t.is(error.name, 'LegibleError')
    t.is(error.code, 'ERR_LEGIBLE_INVALID_URL')
    t.is(error.message, 'Invalid URL: relative URL without a base')
  }
})

test('reusing an extractor does not leak document or URL state', (t) => {
  const extractor = new Extractor()
  const first = extractor.extractSync(HTML, { url: 'https://example.com/first' })
  const secondHtml = HTML.replaceAll('Reusable extraction', 'Second document')
  const second = extractor.extractSync(secondHtml, { url: 'https://example.com/second' })

  t.is(first.metadata.title, 'Reusable extraction')
  t.is(second.metadata.title, 'Second document')
  t.true(first.markdown().includes('https://example.com/article'))
  t.true(second.markdown().includes('https://example.com/article'))
  t.false(second.markdown().includes('Reusable extraction'))
  t.false(second.markdown().includes('first'))
})
