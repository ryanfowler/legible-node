/* Project-owned declarations are added here as the public API is implemented. */

export type LegibleErrorCode =
  | 'ERR_LEGIBLE_INVALID_URL'
  | 'ERR_LEGIBLE_NO_BODY'
  | 'ERR_LEGIBLE_NO_CONTENT'
  | 'ERR_LEGIBLE_CONTENT_ROOT_NOT_FOUND'
  | 'ERR_LEGIBLE_TOO_MANY_ELEMENTS'
  | 'ERR_LEGIBLE_RESOURCE_LIMIT'
  | 'ERR_LEGIBLE_PARSE'
  | 'ERR_LEGIBLE_BINDING_INCOMPATIBLE'

export type ResourceLimit =
  | 'input_bytes'
  | 'dom_nodes'
  | 'elements'
  | 'total_attributes'
  | 'attributes_per_element'
  | 'text_bytes'
  | 'element_depth'
  | 'json_ld_bytes'
  | 'json_ld_items'
  | 'json_ld_depth'

export interface LegibleError extends Error {
  readonly name: 'LegibleError'
  readonly code: LegibleErrorCode
  readonly resource?: ResourceLimit
  readonly limit?: number
  readonly observed?: number
}
/**
 * A retained extracted page with lazy output rendering.
 *
 * The upstream page owns the semantic representation. This wrapper does not
 * cache rendered strings or converted result objects.
 */
export declare class ExtractedPage {
  /** Returns a fresh JavaScript-owned metadata value. */
  get metadata(): Metadata
  /** Returns all public content measurements in one conversion. */
  get metrics(): PageMetrics
  /** Returns extraction diagnostics when they were retained. */
  get diagnostics(): ExtractionDiagnostics | null
  /** Returns metadata diagnostics when they were retained. */
  get metadataDiagnostics(): MetadataDiagnostics | null
  /** Returns retained structured data, or null when retention was disabled. */
  get structuredData(): unknown[] | null
  /** Renders canonical Markdown using the upstream MarkdownBuilder. */
  markdown(options?: MarkdownOptions | undefined | null): string
  /** Renders normalized plain text lazily. */
  text(): string
  /** Renders canonical semantic HTML lazily. */
  html(): string
  private constructor()
}

/** A reusable immutable extraction configuration. */
export declare class Extractor {
  /** Builds an extractor from the supplied configuration. */
  constructor(options?: ExtractorOptions | null | undefined)
  /** Extracts a document using this extractor's immutable configuration. */
  extract(html: string, options?: ExtractCallOptions | undefined | null): ExtractedPage
  /** Extracts a document on napi-rs's libuv worker pool. */
  extractAsync(html: string, options?: ExtractAsyncCallOptions | undefined | null): Promise<ExtractedPage>
}

/** A positive exception that allowed an attempt to be accepted. */
export type AcceptanceException =  'trustedSemanticRoot';

/** Why an extraction attempt was rejected. */
export type AttemptRejectionReason =  'documentChrome'|
'accessBarrier'|
'sourceAccessBarrier'|
'interactiveShell'|
'linkOnlySemanticRoot'|
'incoherentShortResult'|
'lowQuality'|
'potentialHiddenContent'|
'insufficientImprovement'|
'superseded';

/** Evidence source for a selected extraction root. */
export type CandidateSource =  'semantic'|
'readability'|
'structuredData'|
'generic'|
'callerHint';

/** A cleanup stage and the number of elements it removed. */
export interface CleanupAction {
  kind: CleanupActionKind
  removedElements: number
}

/** A major cleanup stage. */
export type CleanupActionKind =  'decorativeMedia'|
'hardCleanup'|
'heuristicCleanup'|
'finalCleanup';

/** Measurements for a source or result region. */
export interface ContentMetrics {
  wordCount: number
  textChars: number
  linkTextChars: number
  paragraphCount: number
  headingCount: number
  listItemCount: number
  codeBlockCount: number
  tableCount: number
  figureCount: number
  imageCount: number
  footnoteReferenceCount: number
  footnoteDefinitionCount: number
  mathCount: number
  structuredBlockCount: number
  linkDensity: number
}

/** A typed selector for content hints and exact content roots. */
export type ContentSelector =
  | { type: 'id', value: string }
  | { type: 'class', value: string }
  | { type: 'tag', value: ContentTag }

/** A content tag accepted by Legible's content selectors. */
export type ContentTag =  'article'|
'main'|
'section'|
'div';

/** Extracts one document using a one-shot configuration. */
export declare function extract(html: string, options?: ExtractOptions | null | undefined): ExtractedPage

/** Extracts one document on napi-rs's libuv worker pool. */
export declare function extractAsync(html: string, options?: ExtractAsyncOptions | null | undefined): Promise<ExtractedPage>

/** Options that apply to one asynchronous extraction call. */
export interface ExtractAsyncCallOptions {
  /** Absolute source/base URL used to resolve relative URLs. */
  url?: string
  /** Cancels the task if it has not started running yet. */
  signal?: AbortSignal | null | undefined
}

/** Options for asynchronous one-shot extraction. */
export interface ExtractAsyncOptions {
  parseBudget?: ParseBudget
  structuredData?: boolean
  diagnostics?: boolean
  metadataDiagnostics?: boolean
  retainStructuredData?: boolean
  contentHint?: ContentSelector
  contentRoot?: ContentSelector
  url?: string
  signal?: AbortSignal | null | undefined
}

/** Options that apply to one extraction call on a reusable extractor. */
export interface ExtractCallOptions {
  /** Absolute source/base URL used to resolve relative URLs. */
  url?: string
}

/** One attempt made by Legible while selecting and cleaning content. */
export interface ExtractionAttempt {
  strategy: ExtractionStrategy
  selectedRoot: RootInfo
  source: ContentMetrics
  result: ContentMetrics
  quality: QualityInfo
  semanticCoverage: SemanticCoverage | null
  cleanupActions: Array<CleanupAction>
  normalization: NormalizationCounts
  representation: RepresentationMetrics
  accepted: boolean
  acceptanceException: AcceptanceException | null
  rejectionReason: AttemptRejectionReason | null
}

/** Structured information about the extraction decision. */
export interface ExtractionDiagnostics {
  selectedStrategy: ExtractionStrategy
  specializedExtractor: string | null
  attempts: Array<ExtractionAttempt>
}

/** The extraction strategy selected by Legible. */
export type ExtractionStrategy =  'normal'|
'relaxedCleanup'|
'broadContent'|
'structuredDataHint'|
'relaxedVisibility'|
'bodyFallback'|
'metadataFallback';

/** Options for one-shot extraction, including reusable extractor configuration. */
export interface ExtractOptions {
  parseBudget?: ParseBudget
  structuredData?: boolean
  diagnostics?: boolean
  metadataDiagnostics?: boolean
  retainStructuredData?: boolean
  contentHint?: ContentSelector
  contentRoot?: ContentSelector
  url?: string
}

/** Reusable extractor configuration. */
export interface ExtractorOptions {
  parseBudget?: ParseBudget
  structuredData?: boolean
  diagnostics?: boolean
  metadataDiagnostics?: boolean
  retainStructuredData?: boolean
  contentHint?: ContentSelector
  contentRoot?: ContentSelector
}

/** Options for rendering an extracted page as Markdown. */
export interface MarkdownOptions {
  /** Whether to render links as Markdown links. Defaults to true. */
  links?: boolean
  /** Whether to render images. Defaults to true. */
  images?: boolean
  /** Preferred maximum prose source-line width. Zero disables wrapping. */
  maxLineWidth?: number
}

/**
 * Metadata returned by a successful extraction.
 *
 * Scalar fields are represented as nullable properties in the generated
 * TypeScript declarations. List fields preserve the order supplied by
 * Legible and are always present.
 */
export interface Metadata {
  title: string | null
  description: string | null
  authors: Array<string>
  siteName: string | null
  canonicalUrl: string | null
  image: string | null
  favicon: string | null
  publishedTime: string | null
  modifiedTime: string | null
  language: string | null
  direction: string | null
  section: string | null
  tags: Array<string>
}

/** Provenance and selection details for all public metadata fields. */
export interface MetadataDiagnostics {
  title: MetadataFieldDiagnostics
  description: MetadataFieldDiagnostics
  authors: MetadataListFieldDiagnostics
  siteName: MetadataFieldDiagnostics
  canonicalUrl: MetadataFieldDiagnostics
  image: MetadataFieldDiagnostics
  favicon: MetadataFieldDiagnostics
  publishedTime: MetadataFieldDiagnostics
  modifiedTime: MetadataFieldDiagnostics
  language: MetadataFieldDiagnostics
  direction: MetadataFieldDiagnostics
  section: MetadataFieldDiagnostics
  tags: MetadataListFieldDiagnostics
}

/** Selection details for a metadata field with one value. */
export interface MetadataFieldDiagnostics {
  selected: MetadataValue | null
  alternatives: Array<MetadataValue>
}

/** Selection details for a metadata field with many values. */
export interface MetadataListFieldDiagnostics {
  selected: Array<MetadataValue>
  alternatives: Array<MetadataValue>
}

/** The source of a discovered metadata value. */
export type MetadataSource =  'jsonLd'|
'openGraph'|
'twitter'|
'dublinCore'|
'citation'|
'htmlMeta'|
'htmlElement'|
'linkElement'|
'inferred';

/** A metadata value together with provenance and confidence. */
export interface MetadataValue {
  value: string
  source: MetadataSource
  confidence: number
}

/** Counts of structures produced by semantic normalization. */
export interface NormalizationCounts {
  codeBlocks: number
  footnoteReferences: number
  footnoteDefinitions: number
  mathExpressions: number
  images: number
  tables: number
  flattenedLayoutTables: number
}

/** Scalar measurements for the retained semantic page content. */
export interface PageMetrics {
  wordCount: number
  textLength: number
  linkTextLength: number
  linkDensity: number
  paragraphCount: number
  headingCount: number
  listItemCount: number
  codeBlockCount: number
  tableCount: number
  figureCount: number
  imageCount: number
  footnoteReferenceCount: number
  footnoteDefinitionCount: number
  mathCount: number
  structuredBlockCount: number
  hasAlphanumericText: boolean
  alphabeticChars: number
  digitChars: number
  hasContextualStructure: boolean
}

/** Parser and structured-data resource limits. */
export interface ParseBudget {
  maxInputBytes?: number
  maxNodes?: number
  maxElements?: number
  maxTotalAttributes?: number
  maxAttributesPerElement?: number
  maxTextBytes?: number
  maxDepth?: number
  maxJsonLdBytes?: number
  maxJsonLdItems?: number
  maxJsonLdDepth?: number
}

/** Quality measurements for one extraction attempt. */
export interface QualityInfo {
  coverage: number
  bestAttemptScore: number
  good: boolean
  suspiciouslySmall: boolean
}

/** Size measurements for the retained representation. */
export interface RepresentationMetrics {
  sourceDomNodes: number
  finalDomNodes: number
  documentNodes: number
  estimatedDocumentBytes: number
}

/** A stable description of the selected extraction root. */
export interface RootInfo {
  tag: string | null
  id: string | null
  classes: Array<string>
  selectionReason: RootSelectionReason
  candidateSources: Array<CandidateSource>
}

/** Why Legible selected an extraction root. */
export type RootSelectionReason =  'ranked'|
'specificChild'|
'sharedParent'|
'completeAncestor'|
'structuredData'|
'articleBody'|
'bodyFallback'|
'metadataFallback';

/** Coverage for one semantic structure category. */
export interface SemanticCategoryCoverage {
  category: SemanticCoverageCategory
  sourceCount: number
  resultCount: number
  coverage: number
}

/** Source-to-result coverage across eligible semantic structures. */
export interface SemanticCoverage {
  score: number
  categories: Array<SemanticCategoryCoverage>
}

/** A category used for source-to-result semantic coverage. */
export type SemanticCoverageCategory =  'codeBlocks'|
'dataTables'|
'substantialListItems'|
'visuals'|
'headings'|
'footnoteDefinitions'|
'mathExpressions';
