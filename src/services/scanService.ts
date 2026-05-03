/**
 * scanService.ts — image scan upload + safe-fallback envelope.
 *
 *   import { analyzeScan } from '../services/scanService';
 *
 *   const result = await analyzeScan(file, { plantName: 'tomato' });
 *   if (result.status === 'needs_attention') showCtaBanner();
 *
 * Endpoint: POST /api/scan/analyze
 *
 * Behaviour
 *   • Accepts only image/jpeg, image/png, image/webp.
 *   • Pre-validates client-side BEFORE upload — invalid files
 *     return the `'uncertain'` fallback envelope without
 *     hitting the network.
 *   • Sends a multipart/form-data POST so the existing
 *     `imageUploadValidator` middleware on the server can
 *     enforce its MIME / size / magic-byte rules.
 *   • On any failure (network, 4xx, 5xx) returns the spec's
 *     `'uncertain'` fallback so the scan UI never crashes.
 *   • Per spec §13: NO direct AI-provider calls; NO scan API
 *     keys in the bundle. Authentication is the existing
 *     bearer token via `apiClient`.
 */

import { apiClient, ApiError, isApiError } from './apiClient';

export type ScanStatus =
  | 'healthy'
  | 'needs_attention'
  | 'uncertain';

export type ScanResult = {
  status:      ScanStatus;
  confidence?: number;            // 0..1 when the engine is confident
  issueType?:  string | null;     // e.g. 'pest_damage' | 'leaf_spot' | null
  explanation: string;            // human-readable, low-literacy
  action:      string;            // suggested next step
  timing:      'now' | 'monitor' | 'later' | string;
  scanId?:     string;
};

const FALLBACK_UNCERTAIN: ScanResult = {
  status:      'uncertain',
  explanation: 'We couldn\u2019t analyze this clearly.',
  action:      'Take another photo in good light.',
  timing:      'monitor',
};

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Max upload size 10 MB — matches the server's
// `imageUploadValidator` cap. Pre-validating client-side saves
// a doomed multipart round-trip on slow connections.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * analyzeScan(file, opts?) → ScanResult
 *
 * Always resolves with a `ScanResult` envelope — never throws.
 *
 * @param file    the image file picked by the user
 * @param opts    optional metadata: plantName / cropName /
 *                country / region / activeExperience
 */
export async function analyzeScan(
  file: File | Blob | null | undefined,
  opts: {
    plantName?:   string;
    cropName?:    string;
    country?:     string;
    region?:      string;
    activeExperience?: 'farm' | 'garden';
  } = {},
): Promise<ScanResult> {
  if (!file) return { ...FALLBACK_UNCERTAIN };

  // Client-side validation — never trust the user's file picker.
  const mime = (file as File).type ? String((file as File).type).toLowerCase() : '';
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ...FALLBACK_UNCERTAIN,
      explanation: 'That file type isn\u2019t supported.',
      action:      'Pick a JPEG, PNG, or WebP photo.',
    };
  }
  const size = (file as Blob).size;
  if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
    return {
      ...FALLBACK_UNCERTAIN,
      explanation: 'That photo is too large to analyze.',
      action:      'Pick a smaller photo (under 10 MB).',
    };
  }

  // Build the multipart payload. The existing /api/scan/analyze
  // route also accepts a JSON body with `imageBase64` — we send
  // multipart so the same body parser can route through the
  // existing `imageUploadValidator` middleware.
  const form = new FormData();
  form.append('image', file, (file as File).name || 'scan.jpg');
  if (opts.plantName)    form.append('plantName',    opts.plantName);
  if (opts.cropName)     form.append('cropName',     opts.cropName);
  if (opts.country)      form.append('country',      opts.country);
  if (opts.region)       form.append('region',       opts.region);
  if (opts.activeExperience) form.append('activeExperience', opts.activeExperience);

  try {
    const res = await apiClient<unknown>('/api/scan/analyze', {
      method:    'POST',
      body:      form,
      multipart: true,
      timeoutMs: 30_000, // scan inference can take a while
    });

    return _normaliseScanResult(res);
  } catch (err: unknown) {
    // Spec §5: on failure, return the fallback envelope —
    // never crash the scan UI.
    if (isApiError(err) && err.status === 429) {
      // Surface the rate-limit signal so the UI can ask the
      // user to wait, but still in the safe envelope shape.
      return {
        ...FALLBACK_UNCERTAIN,
        explanation: 'You\u2019ve scanned a few times in a row.',
        action:      'Wait a moment and try again.',
      };
    }
    void ApiError; // referenced for the import; satisfies linter
    return { ...FALLBACK_UNCERTAIN };
  }
}

/**
 * createScanFollowUpTask(result) → { ok: boolean; taskId?: string }
 *
 * When a scan returns `status: 'needs_attention'`, the UI calls
 * this so the server records a follow-up task event. Failures
 * are silent — the scan result still renders.
 */
export async function createScanFollowUpTask(
  result: ScanResult,
  meta: { plantName?: string } = {},
): Promise<{ ok: boolean; taskId?: string }> {
  try {
    const res = await apiClient<{ ok: boolean; taskId?: string }>('/api/tasks/from-scan', {
      method: 'POST',
      body: {
        plantName:  meta.plantName,
        status:     result.status,
        action:     result.action,
        timing:     result.timing,
        confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
        scanId:     result.scanId,
      },
    });
    return res || { ok: false };
  } catch {
    return { ok: false };
  }
}

function _normaliseScanResult(raw: unknown): ScanResult {
  if (!raw || typeof raw !== 'object') return { ...FALLBACK_UNCERTAIN };
  const r = raw as Record<string, unknown>;
  const status = (typeof r.status === 'string'
    && (r.status === 'healthy' || r.status === 'needs_attention' || r.status === 'uncertain'))
    ? r.status as ScanStatus : 'uncertain';
  const confidence = typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1
    ? r.confidence : undefined;
  return {
    status,
    confidence,
    issueType:   typeof r.issueType === 'string' ? r.issueType : null,
    explanation: typeof r.explanation === 'string' && r.explanation.length > 0
      ? r.explanation : FALLBACK_UNCERTAIN.explanation,
    action: typeof r.action === 'string' && r.action.length > 0
      ? r.action : FALLBACK_UNCERTAIN.action,
    timing: typeof r.timing === 'string' && r.timing.length > 0
      ? r.timing : FALLBACK_UNCERTAIN.timing,
    scanId: typeof r.scanId === 'string' ? r.scanId : undefined,
  };
}

// Exposed for tests + advanced callers.
export const _internal = Object.freeze({
  FALLBACK_UNCERTAIN,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  _normaliseScanResult,
});

export default analyzeScan;
