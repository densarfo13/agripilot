/**
 * normalizeScanConfidence — robustly derive a confidence percent + band from a scan
 * result envelope, regardless of how the confidence arrived.
 *
 * THE BUG THIS FIXES (production, priority #1 scan identification):
 *   result.confidence is OVERLOADED across the scan pipeline —
 *     • a 0–100 number in the recovery path        (ScanPage ~L1197: recovery.confidence)
 *     • a STRING tone 'high'|'medium'|'low'         (ScanPage ~L1157/1612: refinedOut.confidence)
 *     • occasionally a 0–1 float                    (ScanPage ~L658 guards `confidence > 1`)
 *   ScanCommandCard read only the numeric shape (`_num(result.confidence)`). When the
 *   confidence arrived as the string 'high', `_num` returned null → NO percent rendered
 *   and the band silently fell back to 'low' (red) unless a SEPARATE `confidenceBand`
 *   field happened to be populated. Result: a genuinely high-confidence scan shown to the
 *   farmer as a red low-confidence result — a wrong trust signal.
 *
 * This collapses every shape to one honest { pct, band }:
 *   - explicit numeric confidencePct wins
 *   - a string tone maps to its band directly (pct stays null — we never INVENT a number
 *     from a tone)
 *   - number > 1 → treated as a 0–100 percent
 *   - number in (0,1] → treated as a 0–1 fraction, scaled ×100
 *   - an explicit confidenceBand overrides a derived band
 *
 * Pure. Never throws. SSR-safe.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low';
export interface NormalizedConfidence {
  /** 0–100, or null when only a tone (not a number) is known — we do not fabricate a number. */
  pct: number | null;
  /** 'high' | 'medium' | 'low', or null when no confidence signal is present at all. */
  band: ConfidenceBand | null;
}

const TONES: Record<string, ConfidenceBand> = { high: 'high', medium: 'medium', low: 'low' };

/** Map a 0–100 percent to a band using the card's existing thresholds (75 / 45). */
export function bandFromPct(pct: number): ConfidenceBand {
  if (pct >= 75) return 'high';
  if (pct >= 45) return 'medium';
  return 'low';
}

export function normalizeScanConfidence(result: any): NormalizedConfidence {
  if (result == null || typeof result !== 'object') return { pct: null, band: null };

  const rawPct = result.confidencePct;
  const rawConf = result.confidence;

  // 1) Resolve a percent from any numeric source (explicit confidencePct first).
  let pct: number | null = null;
  if (typeof rawPct === 'number' && Number.isFinite(rawPct)) {
    pct = rawPct > 1 ? rawPct : rawPct * 100;
  } else if (typeof rawConf === 'number' && Number.isFinite(rawConf)) {
    pct = rawConf > 1 ? rawConf : rawConf * 100;
  }
  if (pct != null) pct = Math.max(0, Math.min(100, pct));

  // 2) Resolve a band: explicit band → string tone → derived from the percent.
  let band: ConfidenceBand | null = null;
  const rawBand = typeof result.confidenceBand === 'string' ? result.confidenceBand.toLowerCase().trim() : '';
  if (TONES[rawBand]) {
    band = TONES[rawBand];
  } else if (typeof rawConf === 'string' && TONES[rawConf.toLowerCase().trim()]) {
    band = TONES[rawConf.toLowerCase().trim()];
  } else if (pct != null) {
    band = bandFromPct(pct);
  }

  return { pct, band };
}
