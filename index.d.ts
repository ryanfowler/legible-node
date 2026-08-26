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
