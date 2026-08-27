import test from 'ava'
import { readFileSync } from 'node:fs'

import { extract } from '../index.js'
import type { ContentSelector } from '../index.js'

const article = readFileSync(new URL('./fixtures/article.html', import.meta.url), 'utf8')
const metadataHtml = readFileSync(new URL('./fixtures/metadata.html', import.meta.url), 'utf8')
const structures = readFileSync(new URL('./fixtures/structures.html', import.meta.url), 'utf8')
const semanticStructures = readFileSync(new URL('./fixtures/semantic-structures.html', import.meta.url), 'utf8')
const selectors = readFileSync(new URL('./fixtures/selectors.html', import.meta.url), 'utf8')

const articleOptions = { url: 'https://example.com/articles/one' }

function assertFixedShape(value: object, keys: readonly string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`unexpected object shape: ${JSON.stringify(actual)}`)
  }
}

test('article fixture renders deterministic Markdown, text, and canonical HTML', (t) => {
  const page = extract(article, articleOptions)

  t.is(
    page.markdown(),
    'This fixture contains enough meaningful content to exercise the native extraction API and its stable rendered results.\n\nIt includes a [relative link](https://example.com/related) and an image.\n![A meaningful image](https://example.com/image.png)\n',
  )
  t.is(
    page.text(),
    'This fixture contains enough meaningful content to exercise the native extraction API and its stable rendered results. It includes a relative link and an image.',
  )
  t.is(
    page.html(),
    '<div><div><p> This fixture contains enough meaningful content to exercise the native extraction API and its stable rendered results. </p><p>It includes a <a href="https://example.com/related">relative link</a> and an image.</p><img src="https://example.com/image.png" alt="A meaningful image"></div></div>',
  )
  t.is(page.markdown(), page.markdown())
  t.is(page.text(), page.text())
  t.is(page.html(), page.html())
  t.is(page.diagnostics, null)
  t.is(page.metadataDiagnostics, null)
  t.is(page.structuredData, null)
})

test('metadata fixture preserves complete metadata and diagnostics provenance', (t) => {
  const page = extract(metadataHtml, {
    ...articleOptions,
    diagnostics: true,
    metadataDiagnostics: true,
    retainStructuredData: true,
    contentRoot: { type: 'tag', value: 'main' },
  })

  t.deepEqual(page.metadata, {
    title: 'JSON title',
    description: 'JSON description',
    authors: ['JSON Author'],
    siteName: 'Example Site',
    canonicalUrl: 'https://example.com/canonical',
    image: 'https://example.com/og.png',
    favicon: 'https://example.com/favicon.ico',
    publishedTime: '2026-01-01T00:00:00Z',
    modifiedTime: '2026-01-02T00:00:00Z',
    language: 'en',
    direction: 'ltr',
    section: 'Technology',
    tags: ['rust', 'node'],
  })

  const diagnostics = page.metadataDiagnostics
  t.truthy(diagnostics)
  t.is(diagnostics?.title.selected?.value, 'JSON title')
  t.is(diagnostics?.title.selected?.source, 'jsonLd')
  t.is(diagnostics?.title.selected?.confidence, 98)
  t.is(diagnostics?.title.alternatives[0]?.source, 'htmlElement')
  t.is(diagnostics?.authors.selected[0]?.value, 'JSON Author')
  t.is(diagnostics?.authors.alternatives[0]?.source, 'htmlMeta')
  t.is(diagnostics?.siteName.selected?.source, 'openGraph')
  t.is(diagnostics?.canonicalUrl.selected?.source, 'linkElement')
  t.is(diagnostics?.tags.selected[0]?.source, 'openGraph')
  const extractionDiagnostics = page.diagnostics
  t.truthy(extractionDiagnostics)
  if (!extractionDiagnostics) throw new Error('diagnostics were not retained')
  assertFixedShape(extractionDiagnostics, ['selectedStrategy', 'specializedExtractor', 'attempts'])
  t.is(extractionDiagnostics.selectedStrategy, 'normal')
  t.is(extractionDiagnostics.specializedExtractor, null)
  t.is(extractionDiagnostics.attempts.length, 1)
  const attempt = extractionDiagnostics.attempts[0]
  if (!attempt) throw new Error('expected one extraction attempt')
  assertFixedShape(attempt, [
    'strategy',
    'selectedRoot',
    'source',
    'result',
    'quality',
    'semanticCoverage',
    'cleanupActions',
    'normalization',
    'representation',
    'accepted',
    'acceptanceException',
    'rejectionReason',
  ])
  t.is(attempt.strategy, 'normal')
  t.is(attempt.selectedRoot.selectionReason, 'specificChild')
  t.deepEqual(attempt.selectedRoot.candidateSources, ['callerHint'])
  t.true(attempt.accepted)
  t.is(attempt.semanticCoverage, null)
  t.is(attempt.acceptanceException, null)
  t.is(attempt.rejectionReason, null)
  t.is(page.structuredData?.length, 2)
})

test('structured fixture exposes every page metric and semantic output', (t) => {
  const page = extract(structures, articleOptions)
  const metrics = page.metrics

  assertFixedShape(metrics, [
    'wordCount',
    'textLength',
    'linkTextLength',
    'linkDensity',
    'paragraphCount',
    'headingCount',
    'listItemCount',
    'codeBlockCount',
    'tableCount',
    'figureCount',
    'imageCount',
    'footnoteReferenceCount',
    'footnoteDefinitionCount',
    'mathCount',
    'structuredBlockCount',
    'hasAlphanumericText',
    'alphabeticChars',
    'digitChars',
    'hasContextualStructure',
  ])
  t.deepEqual(metrics, {
    wordCount: 23,
    textLength: 146,
    linkTextLength: 0,
    linkDensity: 0,
    paragraphCount: 1,
    headingCount: 0,
    listItemCount: 2,
    codeBlockCount: 1,
    tableCount: 1,
    figureCount: 1,
    imageCount: 1,
    footnoteReferenceCount: 0,
    footnoteDefinitionCount: 0,
    mathCount: 0,
    structuredBlockCount: 4,
    hasAlphanumericText: true,
    alphabeticChars: 117,
    digitChars: 4,
    hasContextualStructure: true,
  })
  t.true(page.markdown().includes('| Name | Value |'))
  t.true(page.markdown().includes('```'))
  t.true(page.html().includes('<table>'))
  t.true(page.text().includes('const answer = 42;'))
})

test('semantic structure metrics retain links, footnotes, and math', (t) => {
  const metrics = extract(semanticStructures, {
    ...articleOptions,
    contentRoot: { type: 'tag', value: 'main' },
  }).metrics

  t.true(metrics.linkTextLength > 0)
  t.true(metrics.linkDensity > 0)
  t.is(metrics.footnoteReferenceCount, 1)
  t.is(metrics.footnoteDefinitionCount, 1)
  t.is(metrics.mathCount, 1)
  t.true(metrics.hasContextualStructure)
})

test('structured data retention is independent from structured-data extraction', (t) => {
  const enabled = extract(metadataHtml)
  const disabled = extract(metadataHtml, { structuredData: false })

  t.is(enabled.structuredData, null)
  t.is(disabled.structuredData, null)
  t.is(enabled.metadata.title, 'JSON title')
  t.is(disabled.metadata.title, 'Fallback title')
  t.is(enabled.metadata.description, 'JSON description')
  t.is(disabled.metadata.description, 'Meta description')
  t.deepEqual(enabled.metadata.authors, ['JSON Author'])
  t.deepEqual(disabled.metadata.authors, ['Meta Author'])
  t.deepEqual(extract(metadataHtml, { retainStructuredData: true }).structuredData?.length, 2)
  t.deepEqual(extract(metadataHtml, { structuredData: false, retainStructuredData: true }).structuredData, [])
})

test('content roots support id, class, and all supported tags', (t) => {
  const cases: Array<[ContentSelector, string]> = [
    [{ type: 'id', value: 'article-id' }, 'ID root'],
    [{ type: 'class', value: 'article-class' }, 'Class root'],
    [{ type: 'tag', value: 'article' }, 'ID root'],
    [{ type: 'tag', value: 'main' }, 'Automatic main'],
    [{ type: 'tag', value: 'section' }, 'Class root'],
    [{ type: 'tag', value: 'div' }, 'Div root'],
  ]

  for (const [contentRoot, expected] of cases) {
    const page = extract(selectors, { contentRoot })
    t.true(page.text().startsWith(expected))
  }

  const error = t.throws(() => extract(selectors, { contentRoot: { type: 'id', value: 'missing' } })) as unknown as {
    code: string
  }
  t.is(error.code, 'ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND')
})

test('content hints accept every selector form without bypassing quality checks', (t) => {
  for (const contentHint of [
    { type: 'id', value: 'article-id' } as const,
    { type: 'class', value: 'article-class' } as const,
    { type: 'tag', value: 'article' } as const,
    { type: 'tag', value: 'main' } as const,
    { type: 'tag', value: 'section' } as const,
    { type: 'tag', value: 'div' } as const,
  ]) {
    const page = extract(selectors, { contentHint })
    t.true(page.text().length > 0)
  }
})

test('markdown options independently control links, images, and wrapping', (t) => {
  const page = extract(article, articleOptions)
  const defaults = page.markdown()

  t.true(defaults.includes('[relative link]('))
  t.true(defaults.includes('![A meaningful image]'))
  t.false(page.markdown({ links: false }).includes('[relative link]('))
  t.true(page.markdown({ links: false }).includes('relative link'))
  t.false(page.markdown({ images: false }).includes('![A meaningful image]'))
  t.is(page.markdown({ maxLineWidth: 0 }), defaults)
  t.not(page.markdown({ maxLineWidth: 32 }), defaults)
  t.false(page.markdown({ links: false, images: false, maxLineWidth: 32 }).includes('!['))
})
