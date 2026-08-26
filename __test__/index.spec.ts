import test from 'ava'

import { readFileSync } from 'node:fs'

test('scaffold export is removed from generated package files', (t) => {
  const loader = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  const declarations = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8')

  t.false(loader.includes('plus100'))
  t.false(declarations.includes('plus100'))
})
