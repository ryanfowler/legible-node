import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const commonjs = require('../index.js')
const esm = await import('../index.js')
const html = '<main><h1>Bun support</h1><p>Enough useful content for the Bun runtime smoke test.</p></main>'

assert.equal(typeof commonjs.extract, 'function')
assert.equal(typeof commonjs.extractSync, 'function')
assert.equal(typeof esm.extract, 'function')
assert.equal(typeof esm.extractSync, 'function')

const syncPage = commonjs.extractSync(html)
assert.match(syncPage.markdown(), /Enough useful content for the Bun runtime smoke test\./)
assert.equal(syncPage.metadata.title, 'Bun support')

const asyncPage = await esm.extract(html)
assert.equal(asyncPage.markdown(), syncPage.markdown())
assert.equal(asyncPage.metadata.title, 'Bun support')

console.log('Bun native binding smoke test passed.')
