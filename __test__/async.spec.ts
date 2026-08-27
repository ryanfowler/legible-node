import test from 'ava'
import { pbkdf2 } from 'node:crypto'

import { ExtractedPage, Extractor, extract, extractAsync } from '../index.js'
import type { LegibleError } from '../index.js'

const HTML = `
  <html>
    <head><title>Async extraction</title></head>
    <body>
      <main>
        <h1>Async extraction</h1>
        <p>This document contains enough meaningful text to exercise asynchronous extraction.</p>
        <p>It also contains a <a href="/article">relative article link</a>.</p>
      </main>
    </body>
  </html>
`

const LARGE_HTML = `<html><body><main>${'<p>Useful content keeps the worker busy while Node remains responsive.</p>'.repeat(50_000)}</main></body></html>`

test('top-level and reusable async extraction have sync parity', async (t) => {
  const options = {
    diagnostics: true,
    structuredData: false,
    url: 'https://example.com/story',
  }
  const sync = extract(HTML, options)
  const oneShot = await extractAsync(HTML, options)
  const reusable = await new Extractor(options).extractAsync(HTML, { url: options.url })

  t.true(oneShot instanceof ExtractedPage)
  t.deepEqual(oneShot.metadata, sync.metadata)
  t.deepEqual(oneShot.metrics, sync.metrics)
  t.deepEqual(oneShot.diagnostics, sync.diagnostics)
  t.is(oneShot.markdown(), sync.markdown())
  t.is(oneShot.text(), sync.text())
  t.is(oneShot.html(), sync.html())
  t.is(reusable.markdown(), sync.markdown())
})

test('async domain errors preserve structured properties', async (t) => {
  const error = (await t.throwsAsync(
    extractAsync(HTML, {
      parseBudget: { maxInputBytes: 1 },
    }),
  )) as LegibleError

  t.is(error.name, 'LegibleError')
  t.is(error.code, 'ERR_LEGIBLE_RESOURCE_LIMIT')
  t.is(error.resource, 'input_bytes')
  t.is(error.limit, 1)
})

test('async extraction yields to the event loop while native work runs', async (t) => {
  let settled = false
  const extraction = extractAsync(LARGE_HTML).finally(() => {
    settled = true
  })
  const eventLoopTurn = new Promise<void>((resolve) => {
    setImmediate(resolve)
  })

  await eventLoopTurn
  t.false(settled)
  await extraction
})

test('concurrent async extractions are isolated', async (t) => {
  const pages = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      extractAsync(
        HTML.replace('<title>Async extraction', `<title>Async extraction ${index}`).replace(
          'relative article link',
          `relative article link ${index}`,
        ),
        { url: `https://example.com/${index}` },
      ),
    ),
  )

  pages.forEach((page, index) => {
    t.true(page.metadata.title?.includes(`${index}`) ?? false)
    t.true(page.markdown().includes(`relative article link ${index}`))
  })
})

test('pre-aborted signals reject and caller handlers remain intact', async (t) => {
  const controller = new AbortController()
  let handlerCalls = 0
  controller.signal.onabort = () => {
    handlerCalls += 1
  }
  controller.abort()

  const error = await t.throwsAsync(extractAsync(HTML, { signal: controller.signal }))
  t.is((error as Error).name, 'AbortError')
  t.is(handlerCalls, 1)
})

test('AbortSignal cancels queued extraction work', async (t) => {
  // Occupy the default libuv worker pool so the extraction task remains
  // queued. Cancellation is intentionally not tested after compute starts.
  const configuredWorkerCount = Number.parseInt(process.env.UV_THREADPOOL_SIZE ?? '', 10)
  const workerCount =
    Number.isSafeInteger(configuredWorkerCount) && configuredWorkerCount > 0 ? configuredWorkerCount : 4
  const blockers = Array.from(
    { length: workerCount },
    () =>
      new Promise<void>((resolve, reject) => {
        pbkdf2('legible', 'node', 500_000, 32, 'sha256', (error) => {
          if (error) reject(error)
          else resolve()
        })
      }),
  )
  const controller = new AbortController()
  let handlerCalls = 0
  controller.signal.onabort = () => {
    handlerCalls += 1
  }
  const pending = [
    extractAsync(LARGE_HTML, { signal: controller.signal }),
    extractAsync(LARGE_HTML, { signal: controller.signal }),
  ]
  controller.abort()

  try {
    const errors = await Promise.all(pending.map((task) => t.throwsAsync(task)))
    errors.forEach((error) => t.is((error as Error).name, 'AbortError'))
    t.is(handlerCalls, 1)
  } finally {
    await Promise.all(blockers)
  }
})
