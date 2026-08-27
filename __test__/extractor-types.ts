import { Extractor, extract } from '../index.js'
import type { ExtractCallOptions, ExtractedPage, ExtractOptions, ExtractorOptions } from '../index.js'

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

void reusablePage
void oneShotPage

// @ts-expect-error Reusable extractor calls accept only per-call URL options.
extractor.extract('<main>content</main>', { diagnostics: true })
