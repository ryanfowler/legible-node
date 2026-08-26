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
  process.exit(0)
}
if (/\bconstructor\s*\(/.test(classDeclaration)) {
  throw new Error('Generated ExtractedPage declaration unexpectedly contains a public constructor')
}

const patchedDeclaration = `${declaration.slice(0, classEnd)}\n  private constructor()${declaration.slice(classEnd)}`
writeFileSync(declarationPath, patchedDeclaration)
