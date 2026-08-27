import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SUPPORTED_TARGETS = new Map([
  ['x86_64-apple-darwin', 'darwin-x64'],
  ['aarch64-apple-darwin', 'darwin-arm64'],
  ['x86_64-unknown-linux-gnu', 'linux-x64-gnu'],
  ['aarch64-unknown-linux-gnu', 'linux-arm64-gnu'],
  ['x86_64-unknown-linux-musl', 'linux-x64-musl'],
  ['aarch64-unknown-linux-musl', 'linux-arm64-musl'],
  ['x86_64-pc-windows-msvc', 'win32-x64-msvc'],
])

function fail(message) {
  throw new Error(`Invalid native release artifacts: ${message}`)
}

function parseArgs(argv) {
  const options = {
    cwd: process.cwd(),
    npmDir: 'npm',
    artifactsDir: undefined,
    packageJson: 'package.json',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) fail(`unknown argument ${argument}`)
    const [name, inlineValue] = argument.split('=', 2)
    const value = inlineValue ?? argv[++index]
    if (value === undefined || value.startsWith('--')) {
      fail(`${name} requires a value`)
    }
    if (name === '--cwd') options.cwd = value
    else if (name === '--npm-dir') options.npmDir = value
    else if (name === '--artifacts-dir') options.artifactsDir = value
    else if (name === '--package-json') options.packageJson = value
    else fail(`unknown argument ${name}`)
  }
  return options
}

async function regularFiles(root) {
  const files = []
  async function visit(directory) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        fail(`symbolic links are not valid artifacts: ${relative(root, path)}`)
      }
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  await visit(root)
  return files
}

async function requireDirectory(path, label) {
  let stats
  try {
    stats = await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT') fail(`${label} does not exist: ${path}`)
    throw error
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    fail(`${label} is not a directory: ${path}`)
  }
}

async function requireBinary(path, expectedName) {
  let stats
  try {
    stats = await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT') fail(`missing ${expectedName}: ${path}`)
    throw error
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    fail(`${expectedName} is not a regular file: ${path}`)
  }
  if (stats.size === 0) fail(`${expectedName} is empty: ${path}`)
}

function expectedArtifacts(packageJson) {
  const napi = packageJson.napi
  if (!napi || !Array.isArray(napi.targets) || napi.targets.length === 0) {
    fail('package.json must configure at least one napi target')
  }
  const binaryName = napi.binaryName
  const packageName = napi.packageName ?? packageJson.name
  if (typeof binaryName !== 'string' || binaryName.length === 0) {
    fail('napi.binaryName must be a non-empty string')
  }
  if (typeof packageName !== 'string' || packageName.length === 0) {
    fail('napi.packageName or package.json name must be a non-empty string')
  }

  const artifacts = []
  const identities = new Set()
  for (const target of napi.targets) {
    const identity = SUPPORTED_TARGETS.get(target)
    if (!identity) fail(`unsupported or unmapped configured target: ${target}`)
    if (identities.has(identity)) fail(`duplicate configured target identity: ${identity}`)
    identities.add(identity)
    artifacts.push({
      target,
      identity,
      filename: `${binaryName}.${identity}.node`,
      packageName: `${packageName}-${identity}`,
    })
  }
  return { binaryName, packageName, artifacts }
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

async function verifySourceArtifacts(directory, expected) {
  await requireDirectory(directory, 'artifact directory')
  const files = (await regularFiles(directory)).filter((path) => path.endsWith('.node'))
  const expectedByName = new Map(expected.map((artifact) => [artifact.filename, artifact]))
  const seen = new Set()
  for (const path of files) {
    const filename = basename(path)
    const artifact = expectedByName.get(filename)
    if (!artifact) fail(`unexpected native binary ${relative(directory, path)}`)
    if (seen.has(filename)) fail(`duplicate native binary ${filename}`)
    seen.add(filename)
    await requireBinary(path, filename)
  }
  const missing = expected.filter((artifact) => !seen.has(artifact.filename))
  if (missing.length) fail(`missing source artifacts: ${missing.map(({ filename }) => filename).join(', ')}`)
  return new Map(await Promise.all(files.map(async (path) => [basename(path), await sha256(path)])))
}

async function verifyCollectedArtifacts(root, npmDir, packageJson, expected, sourceHashes) {
  await requireDirectory(npmDir, 'npm artifact directory')
  const npmEntries = await readdir(npmDir, { withFileTypes: true })
  const expectedIdentities = new Set(expected.map(({ identity }) => identity))
  for (const entry of npmEntries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      fail(`unexpected entry in npm artifact directory: ${entry.name}`)
    }
    if (!expectedIdentities.has(entry.name)) {
      fail(`unconfigured npm target directory: ${entry.name}`)
    }
  }

  const rootEntries = await readdir(root, { withFileTypes: true })
  const rootFiles = rootEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.node'))
    .map((entry) => join(root, entry.name))
  for (const entry of rootEntries) {
    if (entry.isSymbolicLink() && entry.name.endsWith('.node')) {
      fail(`root native binary must not be a symbolic link: ${entry.name}`)
    }
  }
  const rootByName = new Map(rootFiles.map((path) => [basename(path), path]))
  for (const path of rootFiles) {
    const filename = basename(path)
    if (!expected.some((artifact) => artifact.filename === filename)) {
      fail(`unexpected root native binary ${filename}`)
    }
  }

  for (const artifact of expected) {
    const rootPath = join(root, artifact.filename)
    await requireBinary(rootPath, artifact.filename)
    const rootHash = await sha256(rootPath)
    if (sourceHashes?.get(artifact.filename) !== undefined && sourceHashes.get(artifact.filename) !== rootHash) {
      fail(`${artifact.filename} does not match the collected source artifact`)
    }
    await requireDirectory(join(npmDir, artifact.identity), `npm target ${artifact.identity}`)
    const packageRoot = join(npmDir, artifact.identity)
    const manifestPath = join(packageRoot, 'package.json')
    let manifest
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch (error) {
      fail(`cannot read ${manifestPath}: ${error.message}`)
    }
    if (manifest.name !== artifact.packageName) {
      fail(`${manifestPath} has name ${JSON.stringify(manifest.name)}, expected ${artifact.packageName}`)
    }
    if (manifest.version !== packageJson.version) {
      fail(`${manifestPath} has version ${JSON.stringify(manifest.version)}, expected ${packageJson.version}`)
    }
    if (manifest.main !== artifact.filename) {
      fail(`${manifestPath} has main ${JSON.stringify(manifest.main)}, expected ${artifact.filename}`)
    }
    const packageBinary = join(packageRoot, artifact.filename)
    await requireBinary(packageBinary, artifact.filename)
    if ((await sha256(packageBinary)) !== rootHash) {
      fail(`${artifact.filename} does not match the root artifact`)
    }
    if (!rootByName.has(artifact.filename)) fail(`missing root copy ${artifact.filename}`)
  }
}

export async function verifyArtifacts({
  cwd = process.cwd(),
  npmDir = 'npm',
  artifactsDir,
  packageJson = 'package.json',
} = {}) {
  const root = resolve(cwd)
  const packageJsonPath = resolve(root, packageJson)
  let manifest
  try {
    manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  } catch (error) {
    fail(`cannot read ${packageJsonPath}: ${error.message}`)
  }
  const { artifacts } = expectedArtifacts(manifest)
  const sourceHashes = artifactsDir ? await verifySourceArtifacts(resolve(root, artifactsDir), artifacts) : undefined
  await verifyCollectedArtifacts(root, resolve(root, npmDir), manifest, artifacts, sourceHashes)
  return artifacts
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyArtifacts(parseArgs(process.argv.slice(2)))
    console.log('Native release artifacts are complete and consistent.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
