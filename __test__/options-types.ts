import type {
  AcceptanceException,
  AttemptRejectionReason,
  CandidateSource,
  CleanupActionKind,
  ContentMetrics,
  ContentSelector,
  ContentTag,
  ExtractionAttempt,
  ExtractionDiagnostics,
  ExtractionStrategy,
  ExtractorOptions,
  Metadata,
  MetadataDiagnostics,
  MetadataFieldDiagnostics,
  MetadataListFieldDiagnostics,
  MetadataSource,
  MetadataValue,
  NormalizationCounts,
  PageMetrics,
  ParseBudget,
  QualityInfo,
  RepresentationMetrics,
  RootInfo,
  RootSelectionReason,
  SemanticCategoryCoverage,
  SemanticCoverage,
  SemanticCoverageCategory,
} from '../index.js'

const extractionStrategy: ExtractionStrategy = 'relaxedCleanup'
const rootSelectionReason: RootSelectionReason = 'specificChild'
const candidateSource: CandidateSource = 'callerHint'
const semanticCoverageCategory: SemanticCoverageCategory = 'codeBlocks'
const attemptRejectionReason: AttemptRejectionReason = 'lowQuality'
const acceptanceException: AcceptanceException = 'trustedSemanticRoot'
const cleanupActionKind: CleanupActionKind = 'finalCleanup'

const contentMetrics: ContentMetrics = {
  wordCount: 10,
  textChars: 50,
  linkTextChars: 5,
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
  linkDensity: 0.1,
}

const quality: QualityInfo = {
  coverage: 1,
  bestAttemptScore: 1,
  good: true,
  suspiciouslySmall: false,
}

const root: RootInfo = {
  tag: 'main',
  id: null,
  classes: [],
  selectionReason: rootSelectionReason,
  candidateSources: [candidateSource],
}

const semanticCategoryCoverage: SemanticCategoryCoverage = {
  category: semanticCoverageCategory,
  sourceCount: 1,
  resultCount: 1,
  coverage: 1,
}

const semanticCoverage: SemanticCoverage = {
  score: 1,
  categories: [semanticCategoryCoverage],
}

const normalization: NormalizationCounts = {
  codeBlocks: 0,
  footnoteReferences: 0,
  footnoteDefinitions: 0,
  mathExpressions: 0,
  images: 0,
  tables: 0,
  flattenedLayoutTables: 0,
}

const representation: RepresentationMetrics = {
  sourceDomNodes: 1,
  finalDomNodes: 1,
  documentNodes: 1,
  estimatedDocumentBytes: 1,
}

const metadataSource: MetadataSource = 'htmlMeta'

const metadataValue: MetadataValue = {
  value: 'Example',
  source: metadataSource,
  confidence: 76,
}

const metadataField: MetadataFieldDiagnostics = {
  selected: metadataValue,
  alternatives: [],
}

const metadataListField: MetadataListFieldDiagnostics = {
  selected: [metadataValue],
  alternatives: [],
}

const metadataDiagnostics: MetadataDiagnostics = {
  title: metadataField,
  description: metadataField,
  authors: metadataListField,
  siteName: metadataField,
  canonicalUrl: metadataField,
  image: metadataField,
  favicon: metadataField,
  publishedTime: metadataField,
  modifiedTime: metadataField,
  language: metadataField,
  direction: metadataField,
  section: metadataField,
  tags: metadataListField,
}

const attempt: ExtractionAttempt = {
  strategy: extractionStrategy,
  selectedRoot: root,
  source: contentMetrics,
  result: contentMetrics,
  quality,
  semanticCoverage,
  cleanupActions: [{ kind: cleanupActionKind, removedElements: 0 }],
  normalization,
  representation,
  accepted: true,
  acceptanceException,
  rejectionReason: attemptRejectionReason,
}

const diagnostics: ExtractionDiagnostics = {
  selectedStrategy: extractionStrategy,
  specializedExtractor: null,
  attempts: [attempt],
}

void diagnostics
void metadataDiagnostics

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
