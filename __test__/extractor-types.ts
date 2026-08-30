import { Extractor, extract, extractSync } from '../index.js'
import type {
  ExtractCallOptions,
  ExtractOutputOptions,
  ExtractOptions,
  ExtractSyncCallOptions,
  ExtractSyncOptions,
  ExtractedPage,
  ExtractedOutput,
  ExtractorOptions,
  ExtractedPageJson,
} from '../index.js'

const extractorOptions: ExtractorOptions = {
  diagnostics: true,
  contentHint: { type: 'tag', value: 'main' },
}
const syncCallOptions: ExtractSyncCallOptions = { url: 'https://example.com/article' }
const syncOneShotOptions: ExtractSyncOptions = {
  ...extractorOptions,
  url: syncCallOptions.url,
}
const callOptions: ExtractCallOptions = {
  url: syncCallOptions.url,
  signal: new AbortController().signal,
}
const oneShotOptions: ExtractOptions = {
  ...syncOneShotOptions,
  signal: callOptions.signal,
}

const extractor = new Extractor(extractorOptions)
const reusablePage: ExtractedPage = extractor.extractSync('<main>content</main>', syncCallOptions)
const oneShotPage: ExtractedPage = extractSync('<main>content</main>', syncOneShotOptions)
const reusableAsyncPage: Promise<ExtractedPage> = extractor.extract('<main>content</main>', callOptions)
const oneShotAsyncPage: Promise<ExtractedPage> = extract('<main>content</main>', oneShotOptions)
const output: ExtractOutputOptions = {
  markdown: { links: false, images: false, maxLineWidth: 80 },
  html: true,
  text: true,
}
const outputPage: ExtractedPage = extractSync('<main>content</main>', { output })
const renderedOutput: ExtractedOutput | null = outputPage.output
const jsonOutput: ExtractedPageJson = outputPage.toJSON()

void reusablePage
void oneShotPage
void reusableAsyncPage
void oneShotAsyncPage
void renderedOutput
void jsonOutput

// @ts-expect-error Reusable extractor calls accept only per-call URL options.
extractor.extractSync('<main>content</main>', { diagnostics: true })
