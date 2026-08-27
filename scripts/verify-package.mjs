import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET_IDENTITIES = new Map([
  ['x86_64-apple-darwin', 'darwin-x64'],
  ['aarch64-apple-darwin', 'darwin-arm64'],
  ['x86_64-unknown-linux-gnu', 'linux-x64-gnu'],
  ['aarch64-unknown-linux-gnu', 'linux-arm64-gnu'],
  ['x86_64-unknown-linux-musl', 'linux-x64-musl'],
  ['aarch64-unknown-linux-musl', 'linux-arm64-musl'],
  ['x86_64-pc-windows-msvc', 'win32-x64-msvc'],
])
const smokeHtml = '<main><h1>Release package</h1><p>Enough useful content for a release package smoke test.</p></main>'

function npmInvocation() {
  if (process.platform !== 'win32') return { command: 'npm', prefix: [] }
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) throw new Error(`missing npm CLI: ${npmCli}`)
  return { command: process.execPath, prefix: [npmCli] }
}

function runNpm(args, options = {}) {
  const { command, prefix } = npmInvocation()
  return execFileSync(command, [...prefix, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  })
}

function verifyOptionalDependencies(packageJson, includeOptional) {
  if (!includeOptional) return
  const optionalDependencies = packageJson.optionalDependencies
  for (const target of packageJson.napi?.targets ?? []) {
    const identity = TARGET_IDENTITIES.get(target)
    if (!identity) throw new Error(`cannot map configured target ${target} to an npm package identity`)
    const name = `${packageJson.napi.packageName ?? packageJson.name}-${identity}`
    if (optionalDependencies?.[name] !== packageJson.version) {
      throw new Error(`root manifest is missing optional dependency ${name}@${packageJson.version}`)
    }
  }
}

function targetForHost() {
  if (process.platform === 'darwin') return `darwin-${process.arch}`
  if (process.platform === 'win32' && process.arch === 'x64') return 'win32-x64-msvc'
  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) return undefined

  const report = process.report?.getReport?.()
  if (report?.header?.glibcVersionRuntime) return `linux-${process.arch}-gnu`
  if (report?.sharedObjects?.some((file) => file.includes('musl'))) return `linux-${process.arch}-musl`
  try {
    return execFileSync('ldd', ['--version'], { encoding: 'utf8' }).includes('musl')
      ? `linux-${process.arch}-musl`
      : `linux-${process.arch}-gnu`
  } catch {
    return `linux-${process.arch}-gnu`
  }
}

function runSmoke(installDir, packageName, moduleKind) {
  const scriptName = moduleKind === 'esm' ? 'smoke.mjs' : 'smoke.cjs'
  const script =
    moduleKind === 'esm'
      ? `import { extract } from ${JSON.stringify(packageName)}\nconst page = extract(${JSON.stringify(smokeHtml)})\nif (!page.markdown().includes('Enough useful content')) process.exit(1)\n`
      : `const { extract } = require(${JSON.stringify(packageName)})\nconst page = extract(${JSON.stringify(smokeHtml)})\nif (!page.markdown().includes('Enough useful content')) process.exit(1)\n`
  const path = join(installDir, scriptName)
  writeFileSync(path, script)
  execFileSync(process.execPath, [path], { cwd: installDir, stdio: 'pipe' })
}

function normalizePlatformManifests(targetPackages) {
  for (const { directory } of targetPackages) {
    const path = join(directory, 'package.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    writeFileSync(path, JSON.stringify(manifest, null, 2))
  }
}

function pack(packageDirectory, destination) {
  const output = runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', destination], {
    cwd: packageDirectory,
  })
  const result = JSON.parse(output)
  if (!Array.isArray(result) || result.length !== 1 || typeof result[0].filename !== 'string') {
    throw new Error(`npm pack returned an unexpected result for ${packageDirectory}`)
  }
  return join(destination, result[0].filename)
}

export function verifyPackedPackages({
  cwd = projectRoot,
  npmDir = 'npm',
  includeOptional = false,
  saveTarballs,
} = {}) {
  const root = resolve(cwd)
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  verifyOptionalDependencies(packageJson, includeOptional)
  const target = targetForHost()
  if (!target) throw new Error(`unsupported host for package smoke test: ${process.platform}/${process.arch}`)
  const targetDir = join(root, npmDir, target)
  const targetPackageJson = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
  const targetPackages = (packageJson.napi?.targets ?? []).map((configuredTarget) => {
    const identity = TARGET_IDENTITIES.get(configuredTarget)
    if (!identity) throw new Error(`cannot map configured target ${configuredTarget} to an npm package identity`)
    const directory = join(root, npmDir, identity)
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    return { identity, directory, manifest }
  })
  const temp = mkdtempSync(join(tmpdir(), 'legible-node-release-'))

  try {
    // napi pre-publish serializes these manifests without a trailing newline
    // in its publication workspace. Normalize them first so the saved
    // integrity checks describe the exact bytes that will be published.
    normalizePlatformManifests(targetPackages)
    const rootTarball = pack(root, temp)
    const targetTarballs = new Map(
      targetPackages.map(({ identity, directory, manifest }) => [
        manifest.name,
        { identity, path: pack(directory, temp) },
      ]),
    )
    if (saveTarballs) {
      const output = resolve(root, saveTarballs)
      mkdirSync(output, { recursive: true })
      copyFileSync(rootTarball, join(output, 'root.tgz'))
      const tarballs = { [packageJson.name]: 'root.tgz' }
      for (const { identity, path } of targetTarballs.values()) {
        const filename = `${identity}.tgz`
        copyFileSync(path, join(output, filename))
        const packageName = targetPackages.find((item) => item.identity === identity).manifest.name
        tarballs[packageName] = filename
      }
      writeFileSync(join(output, 'manifest.json'), JSON.stringify(tarballs))
    }
    const rootInstall = join(temp, 'root-install')
    runNpm(
      [
        'install',
        '--ignore-scripts',
        ...(includeOptional ? [] : ['--omit=optional']),
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--prefix',
        rootInstall,
        rootTarball,
      ],
      { cwd: root, stdio: 'ignore' },
    )
    runSmoke(rootInstall, packageJson.name, 'cjs')
    runSmoke(rootInstall, packageJson.name, 'esm')

    const targetTarball = targetTarballs.get(targetPackageJson.name)?.path
    if (!targetTarball) throw new Error(`missing packed host package ${targetPackageJson.name}`)
    const targetInstall = join(temp, 'target-install')
    runNpm(
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--prefix',
        targetInstall,
        targetTarball,
      ],
      { cwd: root, stdio: 'ignore' },
    )
    runSmoke(targetInstall, targetPackageJson.name, 'cjs')
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const saveIndex = process.argv.indexOf('--save-tarballs')
    verifyPackedPackages({
      includeOptional: process.argv.includes('--include-optional'),
      saveTarballs: saveIndex === -1 ? undefined : process.argv[saveIndex + 1],
    })
    console.log('Packed root and host platform packages passed smoke tests.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
