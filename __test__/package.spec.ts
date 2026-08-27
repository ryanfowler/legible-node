import test from 'ava'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const html = '<main><h1>Packed package</h1><p>Enough useful content for a packed package smoke test.</p></main>'
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const windowsNpmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

function runNpm(args: string[], options: Parameters<typeof execFileSync>[2]) {
  if (process.platform === 'win32') {
    if (!existsSync(windowsNpmCli)) throw new Error(`missing npm CLI: ${windowsNpmCli}`)
    return execFileSync(process.execPath, [windowsNpmCli, ...args], options)
  }
  return execFileSync('npm', args, options)
}

function nativeTargetForHost() {
  if (process.platform === 'darwin') return `darwin-${process.arch}`
  if (process.platform === 'win32' && process.arch === 'x64') return 'win32-x64-msvc'
  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) return null

  const report = process.report?.getReport?.()
  if (report?.header?.glibcVersionRuntime) return `linux-${process.arch}-gnu`
  if (report?.sharedObjects?.some((file) => file.includes('musl'))) return `linux-${process.arch}-musl`
  try {
    const ldd = execFileSync('ldd', ['--version'], { encoding: 'utf8' })
    return ldd.includes('musl') ? `linux-${process.arch}-musl` : `linux-${process.arch}-gnu`
  } catch {
    return `linux-${process.arch}-gnu`
  }
}

test('the packed package loads through its CJS and ESM entry points', async (t) => {
  const target = nativeTargetForHost()
  if (!target) throw new Error(`unsupported host for package smoke test: ${process.platform}/${process.arch}`)
  const nativeFile = resolve(projectRoot, `legible.${target}.node`)
  if (!existsSync(nativeFile)) throw new Error(`missing host artifact: ${nativeFile}`)

  const temp = mkdtempSync(join(tmpdir(), 'legible-node-package-'))
  try {
    const packOutput = runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const packInfo = JSON.parse(packOutput) as Array<{ filename: string }>
    const tarball = join(temp, packInfo[0].filename)
    const installDir = join(temp, 'install')
    runNpm(
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--prefix', installDir, tarball],
      { cwd: projectRoot, stdio: 'ignore' },
    )

    const cjsSmoke = join(installDir, 'smoke.cjs')
    const esmSmoke = join(installDir, 'smoke.mjs')
    writeFileSync(
      cjsSmoke,
      `const { extract } = require('@ryanfowler/legible')\nprocess.stdout.write(JSON.stringify(extract(${JSON.stringify(html)}).markdown()))\n`,
    )
    writeFileSync(
      esmSmoke,
      `import { extract } from '@ryanfowler/legible'\nprocess.stdout.write(JSON.stringify(extract(${JSON.stringify(html)}).markdown()))\n`,
    )

    const cjsResult = execFileSync(process.execPath, [cjsSmoke], { cwd: installDir, encoding: 'utf8' })
    const esmResult = execFileSync(process.execPath, [esmSmoke], { cwd: installDir, encoding: 'utf8' })
    t.true(JSON.parse(cjsResult).includes('Enough useful content for a packed package smoke test.'))
    t.is(esmResult, cjsResult)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
