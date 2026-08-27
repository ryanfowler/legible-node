import test from 'ava'

import { ExtractedPage, Extractor } from '../index.js'
import type {
  ExtractAsyncOptions,
  ExtractOptions,
  MarkdownOptions,
  Metadata,
  PageMetrics,
  ParseBudget,
} from '../index.js'

type Assert<T extends true> = T
type ContainsBigInt<T> = Extract<T, bigint> extends never ? false : true

type PublicNumbers = ParseBudget[keyof ParseBudget] | MarkdownOptions['maxLineWidth'] | PageMetrics[keyof PageMetrics]
type NumbersDoNotUseBigInt = Assert<ContainsBigInt<PublicNumbers> extends false ? true : false>

const numbersDoNotUseBigInt: NumbersDoNotUseBigInt = true
const budget: ParseBudget = {
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
}
const markdownOptions: MarkdownOptions = { links: false, images: true, maxLineWidth: 80 }
const extractOptions: ExtractOptions = { parseBudget: budget, url: 'https://example.com' }
const asyncOptions: ExtractAsyncOptions = {
  ...extractOptions,
  signal: new AbortController().signal,
}
const extractor = new Extractor()
const page: ExtractedPage = extractor.extract('<main>content</main>')
const metadata: Metadata = page.metadata
const metrics: PageMetrics = page.metrics
const renderedMarkdown: string = page.markdown(markdownOptions)

void numbersDoNotUseBigInt
void checkExtractedPageCannotBeConstructed
void asyncOptions
void page
void metadata
void metrics
void renderedMarkdown

function checkExtractedPageCannotBeConstructed(): void {
  // @ts-expect-error ExtractedPage values are created by extraction.
  new ExtractedPage()
}

// @ts-expect-error Synchronous one-shot options do not accept an AbortSignal.
const invalidSyncOptions: ExtractOptions = { signal: new AbortController().signal }

// @ts-expect-error Public option names use camelCase.
const invalidBudget: ParseBudget = { max_input_bytes: 1 }

void invalidSyncOptions
void invalidBudget

test('public declarations compile against the native API', (t) => {
  t.pass()
})
