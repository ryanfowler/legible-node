import test from 'ava'

import { verifyRelease } from '../scripts/verify-release.mjs'

test('release prerequisites describe the current package without registry access', (t) => {
  const release = verifyRelease()

  t.is(release.name, '@ryanfowler/legible')
  t.regex(release.version, /^\d+\.\d+\.\d+(?:-|$)/)
  t.is(release.prerelease, release.version.includes('-'))
})
