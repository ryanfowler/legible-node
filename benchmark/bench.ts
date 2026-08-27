import { Bench } from 'tinybench'

import { extract, extractAsync } from '../index.js'
import { loadFixtures, type BenchmarkFixture } from './fixtures.js'

type BenchmarkOperation = {
  name: string
  run: () => unknown | Promise<unknown>
}

type BenchmarkRow = {
  fixture: string
  bytes: number
  operation: string
  opsPerSecond: number
  meanMs: number
  p99Ms: number
  samples: number
}

let sink = 0

// Keep benchmark results observable without retaining extracted pages or output
// strings between iterations. This is not intended to measure application work.
function consume(value: unknown): void {
  const size = typeof value === 'string' ? value.length : 1
  sink = (sink + size) % 1_000_000_007
}

function environmentInteger(name: string, fallback: number): number {
  const value = process.env[name]
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer`)
  }
  return parsed
}

const benchOptions = {
  time: environmentInteger('BENCH_TIME_MS', 250),
  warmupTime: environmentInteger('BENCH_WARMUP_MS', 50),
  iterations: process.env.BENCH_ITERATIONS ? environmentInteger('BENCH_ITERATIONS', 1) : undefined,
}

async function runOperations(fixture: BenchmarkFixture, operations: BenchmarkOperation[]): Promise<BenchmarkRow[]> {
  const bench = new Bench(benchOptions)
  for (const operation of operations) bench.add(operation.name, operation.run)
  await bench.run()

  return bench.tasks.map((task) => {
    const result = task.result
    if (!('latency' in result) || !('throughput' in result)) {
      throw new Error(`benchmark did not complete: ${fixture.name}/${task.name}`)
    }
    return {
      fixture: fixture.name,
      bytes: fixture.bytes,
      operation: task.name,
      opsPerSecond: result.throughput.mean,
      meanMs: result.latency.mean,
      p99Ms: result.latency.p99,
      samples: result.latency.samplesCount,
    }
  })
}

function syncOperations(fixture: BenchmarkFixture): BenchmarkOperation[] {
  const { html } = fixture
  return [
    { name: 'sync extraction', run: () => consume(extract(html)) },
    {
      name: 'sync extraction + Markdown',
      run: () => consume(extract(html).markdown()),
    },
    { name: 'sync extraction + text', run: () => consume(extract(html).text()) },
    { name: 'sync extraction + HTML', run: () => consume(extract(html).html()) },
    {
      name: 'sync extraction + all formats',
      run: () => {
        const page = extract(html)
        consume(page.markdown())
        consume(page.text())
        consume(page.html())
      },
    },
    {
      name: 'render-only Markdown (warm)',
      run: (() => {
        const page = extract(html)
        return () => consume(page.markdown())
      })(),
    },
    {
      name: 'render-only text (warm)',
      run: (() => {
        const page = extract(html)
        return () => consume(page.text())
      })(),
    },
    {
      name: 'render-only HTML (warm)',
      run: (() => {
        const page = extract(html)
        return () => consume(page.html())
      })(),
    },
    {
      name: 'render-only all formats (warm)',
      run: (() => {
        const page = extract(html)
        return () => {
          consume(page.markdown())
          consume(page.text())
          consume(page.html())
        }
      })(),
    },
  ]
}

function asyncOperations(fixture: BenchmarkFixture): BenchmarkOperation[] {
  return [
    {
      name: 'async extraction (end-to-end)',
      run: async () => consume(await extractAsync(fixture.html)),
    },
  ]
}

async function run(): Promise<void> {
  const fixtures = loadFixtures()
  const rows: BenchmarkRow[] = []

  for (const fixture of fixtures) {
    rows.push(...(await runOperations(fixture, syncOperations(fixture))))
    rows.push(...(await runOperations(fixture, asyncOperations(fixture))))
  }

  const longForm = fixtures.find((fixture) => fixture.name === 'large-long-form')
  if (!longForm) throw new Error('large-long-form fixture is missing')
  for (const concurrency of [2, 4, 8]) {
    rows.push(
      ...(await runOperations(longForm, [
        {
          name: `async extraction (${concurrency} concurrent)`,
          run: async () => {
            const pages = await Promise.all(Array.from({ length: concurrency }, () => extractAsync(longForm.html)))
            pages.forEach(consume)
          },
        },
      ])),
    )
  }

  const diagnosticsFixture = fixtures.find((fixture) => fixture.name === 'json-ld-heavy')
  if (!diagnosticsFixture) throw new Error('json-ld-heavy fixture is missing')
  const diagnosticPage = extract(diagnosticsFixture.html, {
    diagnostics: true,
    metadataDiagnostics: true,
    retainStructuredData: true,
  })
  rows.push(
    ...(await runOperations(diagnosticsFixture, [
      { name: 'metadata getter conversion', run: () => consume(diagnosticPage.metadata) },
      { name: 'metrics getter conversion', run: () => consume(diagnosticPage.metrics) },
      { name: 'diagnostics getter conversion', run: () => consume(diagnosticPage.diagnostics) },
      { name: 'metadata diagnostics getter conversion', run: () => consume(diagnosticPage.metadataDiagnostics) },
      { name: 'structured data getter conversion', run: () => consume(diagnosticPage.structuredData) },
    ])),
  )

  console.table(rows)
  console.log(`Benchmark sink: ${sink}`)
  console.log(
    `Timing: ${benchOptions.time} ms per task, ${benchOptions.warmupTime} ms warmup; set BENCH_TIME_MS or BENCH_ITERATIONS to adjust.`,
  )
  console.log(
    'Render-only tasks reuse a pre-extracted page, warm it during benchmark warmup, and isolate rendering from extraction.',
  )
  console.log('These measurements are informational and do not enforce a performance threshold.')
}

await run()
