import test from 'ava'

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readLockedRevision } from '../scripts/upstream-revision.mjs'
import { updatePinnedRevision } from '../scripts/update-upstream-revision.mjs'

const current = 'a'.repeat(40)
const next = 'b'.repeat(40)

function createFixture(readme = `https://github.com/ryanfowler/legible/tree/${current}`) {
  const root = mkdtempSync(join(tmpdir(), 'legible-upstream-update-'))
  writeFileSync(
    join(root, 'Cargo.toml'),
    `[dependencies]\nlegible_upstream = { package = "legible", git = "https://github.com/ryanfowler/legible", rev = "${current}" }\n`,
  )
  writeFileSync(join(root, 'README.md'), readme)
  return root
}

test('locked revision parsing accepts Windows line endings', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'legible-upstream-lock-'))
  try {
    const lock = `[[package]]\r\nname = "legible"\r\nversion = "0.5.1"\r\nsource = "git+https://github.com/ryanfowler/legible?rev=${current}#${current}"\r\n`
    const path = join(root, 'Cargo.lock')
    writeFileSync(path, lock)
    t.is(readLockedRevision(path), current)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('upstream updater changes the manifest and revision link', (t) => {
  const root = createFixture()
  try {
    t.deepEqual(updatePinnedRevision(root, next), { current, next })
    t.true(readFileSync(join(root, 'Cargo.toml'), 'utf8').includes(`rev = "${next}"`))
    t.true(readFileSync(join(root, 'README.md'), 'utf8').includes(next))
    t.false(readFileSync(join(root, 'README.md'), 'utf8').includes(current))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('upstream updater rejects a stale README before changing the manifest', (t) => {
  const root = createFixture('https://github.com/ryanfowler/legible/tree/stale')
  try {
    t.throws(() => updatePinnedRevision(root, next), { message: /does not link to current revision/ })
    t.true(readFileSync(join(root, 'Cargo.toml'), 'utf8').includes(`rev = "${current}"`))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
