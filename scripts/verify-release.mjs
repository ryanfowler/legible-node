import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const supportedTargets = new Map([
  ['x86_64-apple-darwin', 'darwin-x64'],
  ['aarch64-apple-darwin', 'darwin-arm64'],
  ['x86_64-unknown-linux-gnu', 'linux-x64-gnu'],
  ['aarch64-unknown-linux-gnu', 'linux-arm64-gnu'],
  ['x86_64-unknown-linux-musl', 'linux-x64-musl'],
  ['aarch64-unknown-linux-musl', 'linux-arm64-musl'],
  ['x86_64-pc-windows-msvc', 'win32-x64-msvc'],
])

function fail(message) {
  throw new Error(`Release validation failed: ${message}`)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`)
  }
}

function validateSemver(version) {
  if (
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    )
  ) {
    fail(`package version is not valid SemVer: ${version}`)
  }
}

function validatePackageManifest(manifest) {
  if (manifest.name !== '@ryanfowler/legible') fail(`unexpected package name: ${manifest.name}`)
  if (typeof manifest.version !== 'string') fail('package version is missing')
  validateSemver(manifest.version)
  if (manifest.engines?.node !== '>=22') fail('Node engine must be >=22')
  if (manifest.engines?.bun !== '>=1.4.0') fail('Bun engine must be >=1.4.0')
  if (manifest.license !== 'Apache-2.0') fail('license must be Apache-2.0')
  if (manifest.main !== 'index.js' || manifest.types !== 'index.d.ts') fail('root entry points are incomplete')
  if (!Array.isArray(manifest.files) || !manifest.files.includes('*.node')) {
    fail('the root package must include native binaries')
  }
  if (manifest.packageManager !== 'pnpm@11.22.0') fail('the pinned pnpm package manager is missing')

  const scripts = manifest.scripts ?? {}
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepublish', 'prepare']) {
    if (scripts[hook]) fail(`consumer install hook is not allowed: ${hook}`)
  }

  const napi = manifest.napi
  if (!napi || napi.binaryName !== 'legible' || napi.packageName !== manifest.name) {
    fail('napi binary and package names are incomplete')
  }
  if (napi.constEnum !== false || napi.runtimeStringEnum !== false) {
    fail('napi enum output must remain type-only')
  }
  if (!Array.isArray(napi.targets) || napi.targets.length !== supportedTargets.size) {
    fail('napi target matrix is incomplete')
  }

  const identities = new Set()
  for (const target of napi.targets) {
    const identity = supportedTargets.get(target)
    if (!identity) fail(`unsupported or unmapped target: ${target}`)
    if (!identities.add(identity)) fail(`duplicate target identity: ${identity}`)
  }
}

function validateGeneratedLoader(manifest) {
  const loader = readFileSync(join(projectRoot, 'index.js'), 'utf8')
  if (!loader.includes(`expected ${manifest.version}`)) {
    fail('generated loader does not contain the package version; run the napi version command')
  }
  if (loader.includes('postinstall') || loader.includes('node-gyp')) {
    fail('generated loader contains an install-time build or download path')
  }
}

function validatePinnedUpstream() {
  const cargo = readFileSync(join(projectRoot, 'Cargo.toml'), 'utf8')
  const match = cargo.match(/legible_upstream[\s\S]*?rev\s*=\s*"([0-9a-f]{40})"/)
  if (!match) fail('Cargo.toml does not pin the upstream Legible revision')
  const lock = readFileSync(join(projectRoot, 'Cargo.lock'), 'utf8')
  if (!lock.includes(`?rev=${match[1]}#${match[1]}`)) {
    fail('Cargo.lock does not contain the pinned upstream revision')
  }
  const readme = readFileSync(join(projectRoot, 'README.md'), 'utf8')
  if (!readme.includes(`https://github.com/ryanfowler/legible/tree/${match[1]}`)) {
    fail('README does not identify the pinned upstream revision')
  }
}

function validateReleaseCommit() {
  const subject = execFileSync('git', ['log', '-1', '--pretty=%s'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const version = readJson(join(projectRoot, 'package.json')).version
  if (subject !== `v${version}` && subject !== version) {
    fail(`release commit subject must be v${version} or ${version}, got ${JSON.stringify(subject)}`)
  }
}

export function verifyRelease({ requireReleaseCommit = false } = {}) {
  const manifest = readJson(join(projectRoot, 'package.json'))
  validatePackageManifest(manifest)
  validateGeneratedLoader(manifest)
  validatePinnedUpstream()
  if (requireReleaseCommit) validateReleaseCommit()
  return { name: manifest.name, version: manifest.version, prerelease: manifest.version.includes('-') }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const requireReleaseCommit = process.argv.includes('--require-release-commit')
    const release = verifyRelease({ requireReleaseCommit })
    console.log(
      `Release prerequisites passed for ${release.name}@${release.version} (${release.prerelease ? 'next' : 'latest'}).`,
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
