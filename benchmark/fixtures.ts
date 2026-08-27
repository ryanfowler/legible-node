import { readFileSync } from 'node:fs'

export interface BenchmarkFixture {
  name: string
  html: string
  bytes: number
}

const fixtureNames = readFileSync(new URL('./fixtures/manifest.txt', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((name) => name.trim())
  .filter(Boolean)

export function loadFixtures(): BenchmarkFixture[] {
  return fixtureNames.map((name) => {
    const html = readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')
    return { name, html, bytes: Buffer.byteLength(html) }
  })
}
