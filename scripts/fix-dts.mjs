import { readFileSync, writeFileSync } from 'node:fs'

const declarationPath = new URL('../index.d.ts', import.meta.url)
const declaration = readFileSync(declarationPath, 'utf8')
const classMatches = [...declaration.matchAll(/^export (?:declare )?class ExtractedPage \{$/gm)]

if (classMatches.length !== 1) {
  throw new Error('Expected exactly one generated ExtractedPage class declaration')
}

const classStart = classMatches[0].index
const classEnd = declaration.indexOf('\n}', classStart)
if (classEnd === -1) {
  throw new Error('Could not locate the end of the generated ExtractedPage class declaration')
}

const classDeclaration = declaration.slice(classStart, classEnd)
if (/\bprivate\s+constructor\s*\(\)/.test(classDeclaration)) {
  // The patch is intentionally idempotent. This also supports running the
  // post-build hook more than once while debugging a generated declaration.
  process.exit(0)
}
if (/\b(?:public\s+)?constructor\s*\(/.test(classDeclaration)) {
  throw new Error('Generated ExtractedPage declaration unexpectedly contains a public constructor')
}

// Keep the constructor declaration at the start of the class. This makes the
// generated API easy to inspect and ensures the patch only changes the one
// declaration that napi-rs cannot currently mark as non-constructible.
const openingBrace = declaration.indexOf('{', classStart)
if (openingBrace === -1 || openingBrace > classEnd) {
  throw new Error('Could not locate the opening brace of ExtractedPage')
}
const patchedDeclaration = `${declaration.slice(0, openingBrace + 1)}\n  private constructor()${declaration.slice(openingBrace + 1)}`
writeFileSync(declarationPath, patchedDeclaration)
