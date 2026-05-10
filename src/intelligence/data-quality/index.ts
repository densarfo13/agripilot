/**
 * data-quality — runtime checks that bad data doesn't degrade
 * trust. Real implementation, not a stub.
 *
 *   • imageQualityHint(dataUrl)   — luminance + variance check
 *   • isStaleWeather(snapshot)    — flags >2h-old snapshots
 *   • normalizeLocation(loc)      — strips junk from a location string
 *   • isValidCropStage(stage)     — guards malformed stages
 *   • shouldGateScanResult(r)     — confidence-floor gate
 *   • dedupeKey(...)              — stable dedup helper
 *
 * Spec §13 — every check returns a calm, surface-able result
 * (boolean / normalized value) without throwing.
 */

export type ImageQualityHint =
  | { ok: true;  reason: null }
  | { ok: false; reason: 'too_small' | 'too_dark' | 'low_detail' | 'unreadable' };

/**
 * Image quality check (mirrors the heuristic in
 * SafeCameraSurface). Pure / SSR-safe — returns ok=true when
 * `document` isn't available so the caller can fall through.
 */
export function imageQualityHint(dataUrl: string | null | undefined): Promise<ImageQualityHint> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined' || !dataUrl) {
        resolve({ ok: true, reason: null }); return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          if (w < 80 || h < 80) { resolve({ ok: false, reason: 'too_small' }); return; }
          const SAMPLE = 32;
          const c = document.createElement('canvas');
          c.width = SAMPLE; c.height = SAMPLE;
          const ctx = c.getContext('2d');
          if (!ctx) { resolve({ ok: true, reason: null }); return; }
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const px = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
          let sum = 0; let sumSq = 0; const n = SAMPLE * SAMPLE;
          for (let i = 0; i < px.length; i += 4) {
            const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            sum += lum; sumSq += lum * lum;
          }
          const mean = sum / n;
          const variance = (sumSq / n) - (mean * mean);
          if (mean < 18) { resolve({ ok: false, reason: 'too_dark' }); return; }
          if (variance < 40) { resolve({ ok: false, reason: 'low_detail' }); return; }
          resolve({ ok: true, reason: null });
        } catch { resolve({ ok: false, reason: 'unreadable' }); }
      };
      img.onerror = () => resolve({ ok: false, reason: 'unreadable' });
      img.src = dataUrl;
    } catch { resolve({ ok: true, reason: null }); }
  });
}

/** Snapshot age guard — a weather snapshot older than 2h is stale. */
export function isStaleWeather(snapshot: { fetchedAt?: string | null } | null | undefined): boolean {
  try {
    const t = Date.parse(String(snapshot?.fetchedAt || ''));
    if (!Number.isFinite(t)) return true;  // unknown → treat as stale
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    return (Date.now() - t) > TWO_HOURS;
  } catch { return true; }
}

/**
 * Normalise a location string — trim, collapse whitespace, drop
 * leading/trailing punctuation. Returns null when nothing useful
 * is left.
 */
export function normalizeLocation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;.|/-]+|[\s,;.|/-]+$/g, '')
    .trim();
  if (!trimmed || trimmed.length < 2) return null;
  return trimmed.slice(0, 120);
}

const VALID_CROP_STAGES = new Set([
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
  'seedling', 'growing', 'ready_to_pick', 'resting',
]);

/** True when the stage is recognised by the engine. */
export function isValidCropStage(stage: unknown): boolean {
  if (typeof stage !== 'string') return false;
  return VALID_CROP_STAGES.has(stage.toLowerCase().trim());
}

/**
 * Confidence-floor gate for scan results. The orchestrator
 * already skips low-confidence candidates via memory cooldowns,
 * but this gate is the explicit boolean for surfaces that need
 * a yes/no decision (e.g. notification fan-out).
 */
export function shouldGateScanResult(
  result: { confidence?: string } | null | undefined,
): boolean {
  const c = String(result?.confidence || '').toLowerCase();
  return c === '' || c === 'low';
}

/** Stable dedup key for orchestration. */
export function dedupeKey(kind: string, key = ''): string {
  return `${String(kind || '').trim()}::${String(key || '').trim()}`;
}

export default Object.freeze({
  imageQualityHint,
  isStaleWeather,
  normalizeLocation,
  isValidCropStage,
  shouldGateScanResult,
  dedupeKey,
});
