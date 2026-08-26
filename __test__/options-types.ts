import type { ContentSelector, ContentTag, ExtractorOptions, ParseBudget } from '../index.js'

const tags: ContentTag[] = ['article', 'main', 'section', 'div']

const selectors: ContentSelector[] = [
  { type: 'id', value: 'article' },
  { type: 'class', value: 'article-body' },
  { type: 'tag', value: 'main' },
]

const budget: ParseBudget = {
  maxInputBytes: 1,
  maxNodes: 2,
  maxElements: 3,
  maxTotalAttributes: 4,
  maxAttributesPerElement: 5,
  maxTextBytes: 6,
  maxDepth: 7,
  maxJsonLdBytes: 8,
  maxJsonLdItems: 9,
  maxJsonLdDepth: 10,
}

const options: ExtractorOptions = {
  parseBudget: budget,
  structuredData: true,
  diagnostics: false,
  metadataDiagnostics: false,
  retainStructuredData: false,
  contentHint: selectors[0],
  contentRoot: selectors[1],
}

void tags
void options

// @ts-expect-error ContentTag only includes the four supported tags.
const unsupportedTag: ContentTag = 'aside'

// @ts-expect-error Selector discriminants are restricted to id, class, and tag.
const unsupportedSelector: ContentSelector = { type: 'css', value: '.article' }

void unsupportedTag
void unsupportedSelector
