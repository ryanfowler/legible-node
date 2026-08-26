import type {
  ContentSelector,
  ContentTag,
  ExtractorOptions,
  Metadata,
  PageMetrics,
  ParseBudget,
} from '../index.js'

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

const metadata: Metadata = {
  title: null,
  description: null,
  authors: ['First author', 'Second author'],
  siteName: null,
  canonicalUrl: null,
  image: null,
  favicon: null,
  publishedTime: null,
  modifiedTime: null,
  language: null,
  direction: null,
  section: null,
  tags: ['rust', 'node'],
}

const metrics: PageMetrics = {
  wordCount: 10,
  textLength: 50,
  linkTextLength: 5,
  linkDensity: 0.1,
  paragraphCount: 1,
  headingCount: 1,
  listItemCount: 2,
  codeBlockCount: 0,
  tableCount: 0,
  figureCount: 0,
  imageCount: 0,
  footnoteReferenceCount: 0,
  footnoteDefinitionCount: 0,
  mathCount: 0,
  structuredBlockCount: 1,
  hasAlphanumericText: true,
  alphabeticChars: 45,
  digitChars: 5,
  hasContextualStructure: false,
}

void metadata
void metrics

// @ts-expect-error Metadata scalar properties are always present and nullable.
const incompleteMetadata: Metadata = { authors: [], tags: [] }

void incompleteMetadata

// @ts-expect-error ContentTag only includes the four supported tags.
const unsupportedTag: ContentTag = 'aside'

// @ts-expect-error Selector discriminants are restricted to id, class, and tag.
const unsupportedSelector: ContentSelector = { type: 'css', value: '.article' }

void unsupportedTag
void unsupportedSelector
