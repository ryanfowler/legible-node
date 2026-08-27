import test from 'ava'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const verifier = resolve('scripts/verify-artifacts.mjs')
const target = 'linux-x64-gnu'
const binary = 'legible.linux-x64-gnu.node'

function createReleaseTree() {
  const root = mkdtempSync(join(tmpdir(), 'legible-artifact-test-'))
  const targetDir = join(root, 'npm', target)
  const sourceDir = join(root, 'artifacts', 'bindings-linux')
  mkdirSync(targetDir, { recursive: true })
  mkdirSync(sourceDir, { recursive: true })
  const packageJson = {
    name: '@example/legible',
    version: '0.1.0',
    napi: {
      binaryName: 'legible',
      packageName: '@example/legible',
      targets: ['x86_64-unknown-linux-gnu'],
    },
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson))
  for (const path of [join(root, binary), join(sourceDir, binary), join(targetDir, binary)]) {
    writeFileSync(path, 'native binary')
  }
  writeFileSync(
    join(targetDir, 'package.json'),
    JSON.stringify({
      name: '@example/legible-linux-x64-gnu',
      version: '0.1.0',
      main: binary,
      files: [binary],
    }),
  )
  return root
}

function runVerifier(root: string) {
  return execFileSync(process.execPath, [verifier, '--cwd', root, '--artifacts-dir', 'artifacts'], {
    encoding: 'utf8',
  })
}

test('artifact verification accepts a complete target set', (t) => {
  const root = createReleaseTree()
  try {
    t.true(runVerifier(root).includes('complete and consistent'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('artifact verification rejects missing and unknown binaries', (t) => {
  const root = createReleaseTree()
  try {
    rmSync(join(root, 'npm', target, binary))
    t.throws(() => runVerifier(root), { message: /missing legible\.linux-x64-gnu\.node/ })

    writeFileSync(join(root, 'npm', target, binary), 'native binary')
    writeFileSync(join(root, binary), 'different native binary')
    t.throws(() => runVerifier(root), { message: /does not match the collected source artifact/ })
    writeFileSync(join(root, binary), 'native binary')
    writeFileSync(join(root, 'artifacts', 'bindings-linux', 'legible.linux-x64-unknown.node'), 'unknown')
    t.throws(() => runVerifier(root), { message: /unexpected native binary/ })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
