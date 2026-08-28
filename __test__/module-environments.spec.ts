import test from 'ava'
import { createRequire } from 'node:module'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

const require = createRequire(import.meta.url)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeHtml = '<main><h1>Module test</h1><p>Enough useful content for module environment checks.</p></main>'

function runWorker(): Promise<{ markdown: string; title: string | null }> {
  const entry = resolve(projectRoot, 'index.js')
  const worker = new Worker(
    `const { parentPort } = require('node:worker_threads')
     const { extractSync } = require(${JSON.stringify(entry)})
     const page = extractSync(${JSON.stringify(nativeHtml)})
     parentPort.postMessage({ markdown: page.markdown(), title: page.metadata.title })`,
    { eval: true },
  )

  return once(worker, 'message').then(([message]) => {
    worker.terminate()
    return message as { markdown: string; title: string | null }
  })
}

test('CommonJS require exposes the native API', async (t) => {
  const commonjs = require('../index.js') as typeof import('../index.js')
  const page = await commonjs.extract(nativeHtml)

  t.is(typeof commonjs.extract, 'function')
  t.is(typeof commonjs.extractSync, 'function')
  t.true(page.markdown().includes('Enough useful content for module environment checks.'))
  t.true(page instanceof commonjs.ExtractedPage)
})

test('ESM named import and CommonJS require agree', async (t) => {
  const esm = await import('../index.js')
  const commonjs = require('../index.js') as typeof esm

  t.is((await esm.extract(nativeHtml)).markdown(), commonjs.extractSync(nativeHtml).markdown())
  t.is(typeof esm.extractSync, 'function')
})

test('the native addon can load and extract in a Worker Thread', async (t) => {
  const result = await runWorker()

  t.is(result.title, 'Module test')
  t.true(result.markdown.includes('Enough useful content for module environment checks.'))
})
