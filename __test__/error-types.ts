import type { LegibleError, LegibleErrorCode, ResourceLimit } from '../index.js'

const code: LegibleErrorCode = 'ERR_LEGIBLE_RESOURCE_LIMIT'
const resource: ResourceLimit = 'json_ld_depth'
const error: LegibleError = Object.assign(new Error('limit exceeded'), {
  name: 'LegibleError' as const,
  code,
  resource,
  limit: 128,
})

void error

// @ts-expect-error Error codes are a closed string union.
const unsupportedCode: LegibleErrorCode = 'ERR_UNKNOWN'

// @ts-expect-error Resource names are a closed string union.
const unsupportedResource: ResourceLimit = 'json_ld_objects'

void unsupportedCode
void unsupportedResource
