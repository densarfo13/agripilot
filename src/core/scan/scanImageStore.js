/**
 * scanImageStore.js — spec-named facade for the canonical scan
 * image store.
 *
 *   import {
 *     storeStableScanImage as storeScanImage,
 *     getCurrentScanImage, replaceScanImage, clearScanImage,
 *     isValidForAnalysis, toAnalyzerInput,
 *   } from 'src/core/scan/scanImageStore.js';
 *
 * The Scan System v2 spec names this file `scanImageStore.ts`. The
 * existing implementation lives at `stableScanImageStore.js` (and
 * already encodes the spec's persistence rules: objectUrl pinned
 * for the lifetime of the scan flow, dataUrlBackup as the survival
 * channel, no early revoke). Pure re-export — one implementation,
 * two paths, no duplicate state.
 *
 * Record shape (preserved from stableScanImageStore):
 *   {
 *     id, file, objectUrl, dataUrlBackup, mimeType,
 *     width, height, source, size, createdAt, persisted,
 *   }
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export {
  storeStableScanImage,
  getCurrentScanImage,
  replaceScanImage,
  clearScanImage,
  setImageDimensions,
  isValidForAnalysis,
  toAnalyzerInput,
  _setUrlHooks,
  _resetUrlHooks,
} from './stableScanImageStore.js';

import _impl from './stableScanImageStore.js';
export default _impl;
