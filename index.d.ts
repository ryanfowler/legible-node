/* Project-owned declarations are added here as the public API is implemented. */
export {}
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
