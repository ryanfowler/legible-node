import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { readPinnedRevision } from './upstream-revision.mjs'

const SHA_PATTERN = /^[0-9a-f]{40}$/

function fail(message) {
  throw new Error(`Upstream update failed: ${message}`)
}

function parseArgs(argv) {
  let sha
  let root = process.cwd()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const [name, inlineValue] = argument.split('=', 2)
    const value = inlineValue ?? argv[++index]
    if (value === undefined || value.startsWith('--')) fail(`${name} requires a value`)
    if (name === '--sha') sha = value
    else if (name === '--root') root = value
    else fail(`unknown argument ${name}`)
  }
  if (!sha || !SHA_PATTERN.test(sha)) fail('--sha must be a 40-character lowercase commit SHA')
  return { root: resolve(root), sha }
}

export function updatePinnedRevision(root, sha) {
  if (!SHA_PATTERN.test(sha)) fail('--sha must be a 40-character lowercase commit SHA')

  const cargoPath = join(root, 'Cargo.toml')
  const cargo = readFileSync(cargoPath, 'utf8')
  const dependencyPattern = /(legible_upstream\s*=\s*\{)([\s\S]*?)(\})/
  const dependency = cargo.match(dependencyPattern)
  if (!dependency) fail('Cargo.toml does not contain the legible_upstream dependency')

  const currentRevisions = [...dependency[2].matchAll(/\brev\s*=\s*"([0-9a-f]{40})"/g)]
  if (currentRevisions.length !== 1) fail('legible_upstream must contain exactly one pinned revision')
  const current = currentRevisions[0][1]
  if (current === sha) fail(`revision is already ${sha}`)

  const readmePath = join(root, 'README.md')
  const readme = readFileSync(readmePath, 'utf8')
  const currentLink = `https://github.com/ryanfowler/legible/tree/${current}`
  if (!readme.includes(currentLink)) fail(`README does not link to current revision ${current}`)

  const updatedCargo = cargo.replace(dependencyPattern, (_match, prefix, body, suffix) => {
    return `${prefix}${body.replace(current, sha)}${suffix}`
  })
  writeFileSync(cargoPath, updatedCargo)
  writeFileSync(readmePath, readme.replaceAll(current, sha))

  return { current, next: sha }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { root, sha } = parseArgs(process.argv.slice(2))
    const result = updatePinnedRevision(root, sha)
    console.log(`Updated Legible revision: ${result.current} -> ${result.next}`)
    console.log('Run cargo update for Cargo.lock, then the complete validation suite.')
    // Keep the import used as a direct sanity check when this script is run in a checkout.
    if (readPinnedRevision(join(root, 'Cargo.toml')) !== sha) fail('Cargo.toml update did not persist')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
