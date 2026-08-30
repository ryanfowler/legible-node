import { readFileSync } from 'node:fs'

const declarationPath = new URL('../index.d.ts', import.meta.url)
const declaration = readFileSync(declarationPath, 'utf8')

function fail(message) {
  throw new Error(`Invalid generated TypeScript declaration: ${message}`)
}

function assertMatch(pattern, message) {
  if (!pattern.test(declaration)) fail(message)
}

function assertAbsent(pattern, message) {
  if (pattern.test(declaration)) fail(message)
}

function declarationBody(kind, name) {
  const matches = [
    ...declaration.matchAll(new RegExp(`^export (?:declare )?${kind} ${name} \\{([\\s\\S]*?)^\\}`, 'gm')),
  ]
  if (matches.length !== 1) {
    fail(`expected one exported ${kind} declaration for ${name}`)
  }
  return matches[0][1]
}

const page = declarationBody('class', 'ExtractedPage')
if (!/^\s*private constructor\(\)\s*$/m.test(page)) {
  fail('ExtractedPage must have a private constructor')
}
if (/^\s*(?:public\s+)?constructor\(/m.test(page)) {
  fail('ExtractedPage must not have a public constructor')
}

const extractor = declarationBody('class', 'Extractor')
assertMatch(/^\s*constructor\(options\?: ExtractorOptions \| null \| undefined\)/m, 'Extractor constructor is missing')
if (/^\s*private constructor\(\)\s*$/m.test(extractor)) {
  fail('Extractor must remain constructible')
}

for (const signature of [
  'export declare function extract(html: string, options?: ExtractOptions | null | undefined): Promise<ExtractedPage>',
  'export declare function extractSync(html: string, options?: ExtractSyncOptions | null | undefined): ExtractedPage',
  'extract(html: string, options?: ExtractCallOptions | undefined | null): Promise<ExtractedPage>',
  'extractSync(html: string, options?: ExtractSyncCallOptions | undefined | null): ExtractedPage',
]) {
  const prefix = signature.startsWith('export ') ? '^' : '^\\s+'
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assertMatch(new RegExp(`${prefix}${escaped}$`, 'm'), `${signature} is missing`)
}

for (const interfaceName of [
  'Metadata',
  'PageMetrics',
  'ParseBudget',
  'ExtractorOptions',
  'ExtractOptions',
  'ExtractCallOptions',
  'ExtractSyncCallOptions',
  'ExtractSyncOptions',
  'ExtractOutputOptions',
  'ExtractedOutput',
  'ExtractedPageJson',
  'MarkdownOptions',
  'ExtractionDiagnostics',
  'MetadataDiagnostics',
]) {
  declarationBody('interface', interfaceName)
}

for (const property of [
  'maxInputBytes',
  'maxNodes',
  'maxElements',
  'maxTotalAttributes',
  'maxAttributesPerElement',
  'maxTextBytes',
  'maxDepth',
  'maxJsonLdBytes',
  'maxJsonLdItems',
  'maxJsonLdDepth',
  'structuredData',
  'metadataDiagnostics',
  'retainStructuredData',
  'contentHint',
  'contentRoot',
  'output',
  'maxLineWidth',
  'siteName',
  'canonicalUrl',
  'publishedTime',
  'modifiedTime',
  'wordCount',
  'textLength',
  'hasAlphanumericText',
  'hasContextualStructure',
]) {
  assertMatch(new RegExp(`^\\s+${property}\\??:`, 'm'), `${property} must use its camelCase public name`)
}

assertAbsent(/\b[a-z][A-Za-z]*_[a-zA-Z][A-Za-z]*\??\s*:/, 'snake_case property leaked into the public API')
assertAbsent(/\bbigint\b/, 'bigint leaked into the public API')
assertAbsent(/\benum\s+/, 'a TypeScript enum leaked into the public API')
assertAbsent(/plus100/, 'the scaffold API leaked into the public API')

for (const typeName of [
  'ContentTag',
  'ContentSelector',
  'ExtractionStrategy',
  'RootSelectionReason',
  'CandidateSource',
  'MetadataSource',
  'SemanticCoverageCategory',
]) {
  assertMatch(new RegExp(`^export type ${typeName} =`, 'm'), `${typeName} must be a type union`)
}

console.log('TypeScript declarations are structurally valid.')
