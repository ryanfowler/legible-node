import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHA_PATTERN = /^[0-9a-f]{40}$/

function fail(message) {
  throw new Error(`Upstream revision check failed: ${message}`)
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`)
  }
}

/**
 * Read the pinned revision without consulting the network or Cargo's cache.
 * Keeping this operation local makes it safe to use in release checks.
 */
export function readPinnedRevision(cargoPath = join(projectRoot, 'Cargo.toml')) {
  const cargo = readText(cargoPath)
  const dependencies = [...cargo.matchAll(/legible_upstream\s*=\s*\{([\s\S]*?)\}/g)]
  if (dependencies.length !== 1) {
    fail(`expected one legible_upstream dependency, found ${dependencies.length}`)
  }

  const revisions = [...dependencies[0][1].matchAll(/\brev\s*=\s*"([0-9a-f]{40})"/g)]
  if (revisions.length !== 1) {
    fail(`expected one 40-character Legible revision, found ${revisions.length}`)
  }
  return revisions[0][1]
}

function readLockedUpstreamBlock(lockPath) {
  // Git may check this file out with CRLF on Windows.
  const lock = readText(lockPath).replace(/\r\n?/g, '\n')
  const packageBlocks = lock
    .split(/\n(?=\[\[package\]\])/)
    .filter(
      (block) =>
        block.startsWith('[[package]]\nname = "legible"\n') &&
        /\nsource = "git\+https:\/\/github\.com\/ryanfowler\/legible\?/.test(block),
    )
  if (packageBlocks.length !== 1) {
    fail(`expected one locked upstream Legible package, found ${packageBlocks.length}`)
  }
  return packageBlocks[0]
}

export function readLockedPackageSpec(lockPath = join(projectRoot, 'Cargo.lock')) {
  const version = readLockedUpstreamBlock(lockPath).match(/^version = "([^"]+)"$/m)?.[1]
  if (!version) fail('locked upstream Legible package has no version')
  return `legible@${version}`
}

export function readLockedRevision(lockPath = join(projectRoot, 'Cargo.lock')) {
  const source = readLockedUpstreamBlock(lockPath).match(
    /^source = "git\+https:\/\/github\.com\/ryanfowler\/legible\?rev=([0-9a-f]{40})#([0-9a-f]{40})"$/m,
  )
  if (!source || source[1] !== source[2]) fail('locked upstream Legible source is not pinned to one revision')
  return source[1]
}

export function checkPinnedRevision(root = projectRoot) {
  const revision = readPinnedRevision(join(root, 'Cargo.toml'))
  if (!SHA_PATTERN.test(revision)) fail(`invalid revision ${revision}`)

  const lockedRevision = readLockedRevision(join(root, 'Cargo.lock'))
  if (lockedRevision !== revision) {
    fail(`Cargo.lock contains revision ${lockedRevision}, expected ${revision}`)
  }

  const readme = readText(join(root, 'README.md'))
  const link = `https://github.com/ryanfowler/legible/tree/${revision}`
  if (!readme.includes(link)) fail(`README does not link to revision ${revision}`)

  return revision
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv.length === 1 && !['--check', '--package-spec'].includes(argv[0]))) {
    fail(`usage: ${pathToFileURL(process.argv[1]).pathname} [--check|--package-spec]`)
  }
  return { check: argv[0] === '--check', packageSpec: argv[0] === '--package-spec' }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { check, packageSpec } = parseArgs(process.argv.slice(2))
    const value = packageSpec ? readLockedPackageSpec() : check ? checkPinnedRevision() : readPinnedRevision()
    console.log(value)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
