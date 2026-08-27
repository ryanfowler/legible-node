interface BenchmarkMemoryUsage {
  rss: number
  heapUsed: number
  external: number
}

declare const process: {
  env: Record<string, string | undefined>
  memoryUsage(): BenchmarkMemoryUsage
}

declare const Buffer: {
  byteLength(value: string): number
}

declare function setImmediate(callback: () => void): unknown

declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string
}
