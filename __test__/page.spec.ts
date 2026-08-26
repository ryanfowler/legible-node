import test from 'ava'

import { ExtractedPage } from '../index.js'

test('exports ExtractedPage without a public runtime constructor', (t) => {
  t.is(typeof ExtractedPage, 'function')

  const PageConstructor = ExtractedPage as unknown as new () => unknown
  t.throws(() => new PageConstructor())
})
