import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

function parseArgs(argv) {
  const options = {
    registry: process.env.npm_config_registry ?? 'https://registry.npmjs.org/',
    platformsOnly: false,
    requireProvenance: false,
    retries: 6,
    delayMs: 5000,
    localTarballs: undefined,
    tag: undefined,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const [name, inlineValue] = argument.split('=', 2)
    if (name === '--platforms-only') options.platformsOnly = true
    else if (name === '--require-provenance') options.requireProvenance = true
    else if (name === '--registry') options.registry = inlineValue ?? argv[++index]
    else if (name === '--retries') options.retries = Number(inlineValue ?? argv[++index])
    else if (name === '--delay-ms') options.delayMs = Number(inlineValue ?? argv[++index])
    else if (name === '--local-tarballs') options.localTarballs = inlineValue ?? argv[++index]
    else if (name === '--tag') options.tag = inlineValue ?? argv[++index]
    else throw new Error(`unknown argument ${argument}`)
  }
  if (!Number.isInteger(options.retries) || options.retries < 1) throw new Error('--retries must be a positive integer')
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0)
    throw new Error('--delay-ms must be a non-negative integer')
  return options
}

function npmInvocation() {
  if (process.platform !== 'win32') return { command: 'npm', prefix: [] }
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) throw new Error(`missing npm CLI: ${npmCli}`)
  return { command: process.execPath, prefix: [npmCli] }
}

function packageMetadata(name, version, registry) {
  const { command, prefix } = npmInvocation()
  const output = execFileSync(command, [...prefix, 'view', `${name}@${version}`, '--json', '--registry', registry], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output)
}

function packageDistTags(name, registry) {
  const { command, prefix } = npmInvocation()
  const output = execFileSync(command, [...prefix, 'view', name, 'dist-tags', '--json', '--registry', registry], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output)
}

function tarballIntegrity(path) {
  return `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`
}

function verifyMetadata(name, version, registry, requireProvenance, expectedIntegrity, expectedTag) {
  const metadata = packageMetadata(name, version, registry)
  if (metadata?.version !== version) {
    throw new Error(`${name}@${version} resolved to ${JSON.stringify(metadata?.version)}`)
  }
  if (typeof metadata?.dist?.tarball !== 'string' || typeof metadata?.dist?.integrity !== 'string') {
    throw new Error(`${name}@${version} has incomplete registry dist metadata`)
  }
  if (requireProvenance && !metadata?.dist?.attestations?.provenance) {
    throw new Error(`${name}@${version} has no npm provenance attestation in registry metadata`)
  }
  if (expectedTag && packageDistTags(name, registry)?.[expectedTag] !== version) {
    throw new Error(`${name}@${version} is not the ${expectedTag} dist-tag`)
  }
  if (expectedIntegrity && metadata.dist.integrity !== expectedIntegrity) {
    throw new Error(`${name}@${version} does not match the validated local tarball`)
  }
}

function verifyPackage(name, version, options) {
  let expectedIntegrity
  if (options.localTarballs) {
    const filename = options.localTarballs[name]
    if (typeof filename !== 'string') throw new Error(`local tarball manifest is missing ${name}`)
    const path = join(options.localTarballs.directory, filename)
    if (!existsSync(path)) throw new Error(`local tarball does not exist for ${name}: ${path}`)
    expectedIntegrity = tarballIntegrity(path)
  }
  let lastError
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      verifyMetadata(name, version, options.registry, options.requireProvenance, expectedIntegrity, options.tag)
      console.log(`Verified ${name}@${version}`)
      return
    } catch (error) {
      lastError = error
      if (attempt < options.retries) {
        console.warn(`Waiting for ${name}@${version} to appear (attempt ${attempt}/${options.retries})`)
        if (options.delayMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, options.delayMs)
      }
    }
  }
  throw new Error(`Registry verification failed for ${name}@${version}: ${lastError.message}`)
}

export function verifyPublishedPackages({
  packageJsonPath = 'package.json',
  registry = 'https://registry.npmjs.org/',
  platformsOnly = false,
  requireProvenance = false,
  retries = 6,
  delayMs = 5000,
  localTarballs,
  tag,
} = {}) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const packageName = packageJson.napi?.packageName ?? packageJson.name
  const targets = packageJson.napi?.targets
  if (typeof packageName !== 'string' || !Array.isArray(targets))
    throw new Error('package.json has no complete napi package configuration')
  const identities = targets.map((target) => {
    const match = target.match(/^(x86_64|aarch64)-(?:unknown-)?(apple-darwin|linux-(?:gnu|musl)|pc-windows-msvc)$/)
    if (!match) throw new Error(`cannot map configured target ${target} to an npm package identity`)
    const arch = match[1] === 'x86_64' ? 'x64' : 'arm64'
    const platform = match[2]
    if (platform === 'apple-darwin') return `darwin-${arch}`
    if (platform === 'pc-windows-msvc') return `win32-${arch}-msvc`
    return `linux-${arch}-${platform.slice('linux-'.length)}`
  })
  const packages = platformsOnly ? identities : ['', ...identities]
  let tarballManifest
  if (localTarballs) {
    tarballManifest = {
      directory: localTarballs,
      ...JSON.parse(readFileSync(join(localTarballs, 'manifest.json'), 'utf8')),
    }
  }
  const options = {
    registry,
    requireProvenance,
    retries,
    delayMs,
    tag: tag ?? (packageJson.version.includes('-') ? 'next' : 'latest'),
    localTarballs: tarballManifest,
  }
  for (const identity of packages) {
    verifyPackage(identity ? `${packageName}-${identity}` : packageName, packageJson.version, options)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyPublishedPackages({ ...parseArgs(process.argv.slice(2)), packageJsonPath: 'package.json' })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
