import { extractSync } from '../index.js'
import { loadFixtures } from './fixtures.js'

declare global {
  // Node provides this only when started with --expose-gc.
  var gc: (() => void) | undefined
}

type MemoryRow = {
  cycle: number
  rssMiB: number
  rssDeltaMiB: number
  heapUsedMiB: number
  externalMiB: number
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

function memory(): BenchmarkMemoryUsage {
  return process.memoryUsage()
}

function mib(bytes: number): number {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

async function run(): Promise<void> {
  const cycles = environmentInteger('MEMORY_CYCLES', 5)
  const iterations = environmentInteger('MEMORY_ITERATIONS', 100)
  const fixtures = loadFixtures()
  const baseline = memory()
  const rows: MemoryRow[] = []
  let peakRss = baseline.rss
  let sink = 0

  if (typeof globalThis.gc !== 'function') {
    console.warn('Run with --expose-gc for the most useful post-GC measurements.')
  }

  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const fixture = fixtures[(cycle * iterations + iteration) % fixtures.length]
      let page: ReturnType<typeof extractSync> | undefined = extractSync(fixture.html, {
        diagnostics: true,
        metadataDiagnostics: true,
        retainStructuredData: true,
      })

      // Exercise every lazy output path while the result is live. The page is
      // explicitly cleared below so the next cycle measures object teardown.
      sink += page.markdown().length + page.text().length + page.html().length
      sink += page.metadata.title?.length ?? 0
      sink += page.metrics.wordCount
      sink += page.diagnostics?.attempts.length ?? 0
      sink += page.metadataDiagnostics?.title.alternatives.length ?? 0
      sink += page.structuredData?.length ?? 0
      page = undefined
    }

    if (typeof globalThis.gc === 'function') {
      globalThis.gc()
      globalThis.gc()
    }
    await new Promise<void>((resolve) => setImmediate(resolve))

    const current = memory()
    peakRss = Math.max(peakRss, current.rss)
    rows.push({
      cycle,
      rssMiB: mib(current.rss),
      rssDeltaMiB: mib(current.rss - baseline.rss),
      heapUsedMiB: mib(current.heapUsed),
      externalMiB: mib(current.external),
    })
  }

  console.table(rows)
  console.log(`Peak RSS: ${mib(peakRss)} MiB`)
  console.log(`Final RSS delta after GC: ${mib(memory().rss - baseline.rss)} MiB`)
  console.log(`Memory sink: ${sink}`)
  console.log(
    'RSS includes allocator and runtime state. Use the per-cycle post-GC trend as a diagnostic, not as a pass/fail limit.',
  )
}

await run()
