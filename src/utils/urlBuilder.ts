/**
 * urlBuilder.ts — spec-path re-export.
 *
 * The canonical implementation lives at src/lib/urlBuilder.ts.
 * The Production Runtime Stabilization spec §1 names the helper
 * src/utils/urlBuilder.ts; this thin re-export makes both paths
 * valid so callers can import from either location.
 *
 *   import { buildUrl, buildApiUrl } from '@/utils/urlBuilder';
 *   import { buildUrl, buildApiUrl } from '@/lib/urlBuilder';
 *
 * Both resolve to the same singleton implementation.
 */

export {
  API_BASE_URL,
  buildUrl,
  buildApiUrl,
  buildFetchUrl,
  isBuildable,
  buildUrlOr,
  _resetInvalidUrlMemo,
} from '../lib/urlBuilder.ts';

export type { BuildUrlOptions } from '../lib/urlBuilder.ts';

import _module from '../lib/urlBuilder.ts';
export default _module;
