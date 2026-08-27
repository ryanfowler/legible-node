import { Extractor, extract, extractAsync } from '../index.js'
import type {
  ExtractAsyncCallOptions,
  ExtractAsyncOptions,
  ExtractCallOptions,
  ExtractedPage,
  ExtractOptions,
  ExtractorOptions,
} from '../index.js'

const extractorOptions: ExtractorOptions = {
  diagnostics: true,
  contentHint: { type: 'tag', value: 'main' },
}
const callOptions: ExtractCallOptions = { url: 'https://example.com/article' }
const oneShotOptions: ExtractOptions = {
  ...extractorOptions,
  url: callOptions.url,
}

const extractor = new Extractor(extractorOptions)
const reusablePage: ExtractedPage = extractor.extract('<main>content</main>', callOptions)
const oneShotPage: ExtractedPage = extract('<main>content</main>', oneShotOptions)
const asyncCallOptions: ExtractAsyncCallOptions = {
  url: callOptions.url,
  signal: new AbortController().signal,
}
const asyncOptions: ExtractAsyncOptions = {
  ...oneShotOptions,
  signal: asyncCallOptions.signal,
}
const reusableAsyncPage: Promise<ExtractedPage> = extractor.extractAsync('<main>content</main>', asyncCallOptions)
const oneShotAsyncPage: Promise<ExtractedPage> = extractAsync('<main>content</main>', asyncOptions)

void reusablePage
void oneShotPage
void reusableAsyncPage
void oneShotAsyncPage

// @ts-expect-error Reusable extractor calls accept only per-call URL options.
extractor.extract('<main>content</main>', { diagnostics: true })
