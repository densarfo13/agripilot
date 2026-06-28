/**
 * evidenceConflict.ts — cross-source evidence CONFLICT detector (FIP ConflictEngine).
 *
 * When two INDEPENDENT evidence sources make OPPOSITE claims on the same axis (e.g. the
 * scan photo reads "water stress / dry" but the soil reading reads "waterlogged / wet"),
 * the honest answer is NOT to pick one — it is to surface the conflict and recommend the
 * farmer verify before acting. Acting on the wrong half (watering a waterlogged crop)
 * causes harm, so a flagged conflict is safer than a confident guess.
 *
 * Conservative by design: only flags a TRUE opposite-polarity disagreement between
 * DIFFERENT sources on the SAME axis. Anything ambiguous → no conflict (no false alarms).
 * Pure, total, language-neutral (key + English fallback).
 */
export interface EvidenceClaim {
  source: string;     // farmer-facing source name, e.g. 'photo', 'soil reading'
  axis: string;       // the dimension being claimed, e.g. 'moisture'
  polarity: string;   // the value on that axis, e.g. 'dry' | 'wet'
  detail?: string;
}

export interface ConflictVerdict {
  hasConflict: boolean;
  axis: string | null;
  sources: ReadonlyArray<string>;
  polarities: ReadonlyArray<string>;
  messageKey: string;
  message: string;            // English fallback
  recommendation: 'verify' | 'none';
}

// Opposite-polarity pairs per axis. Symmetric.
const OPPOSITES: Record<string, [string, string]> = {
  moisture: ['dry', 'wet'],
};

const NONE: ConflictVerdict = Object.freeze({
  hasConflict: false, axis: null, sources: Object.freeze([]), polarities: Object.freeze([]),
  messageKey: 'scan.conflict.none', message: '', recommendation: 'none',
});

const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _isOpposite = (axis: string, a: string, b: string): boolean => {
  const pair = OPPOSITES[axis];
  if (!pair) return false;
  return (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]);
};

/**
 * Detect a cross-source conflict. Returns the FIRST genuine conflict found.
 * @param claims normalized claims from independent sources.
 */
export function detectEvidenceConflict(claims: unknown): ConflictVerdict {
  try {
    const list = _arr(claims).filter((c) =>
      c && typeof c === 'object' && c.source && c.axis && c.polarity);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.source === b.source) continue;              // a source can't conflict with itself
        if (a.axis !== b.axis) continue;                  // only compare the same axis
        if (!_isOpposite(a.axis, String(a.polarity), String(b.polarity))) continue;
        return Object.freeze({
          hasConflict: true,
          axis: String(a.axis),
          sources: Object.freeze([String(a.source), String(b.source)]),
          polarities: Object.freeze([String(a.polarity), String(b.polarity)]),
          messageKey: 'scan.conflict.detected',
          message: 'These signals disagree — ' + String(a.source) + ' suggests ' + String(a.polarity)
                 + ' but ' + String(b.source) + ' suggests ' + String(b.polarity)
                 + '. Check your field before acting, so you don’t make it worse.',
          recommendation: 'verify',
        });
      }
    }
    return NONE;
  } catch {
    return NONE;
  }
}

export function evidenceConflictHealth() {
  const conflict = detectEvidenceConflict([
    { source: 'photo', axis: 'moisture', polarity: 'dry' },
    { source: 'soil reading', axis: 'moisture', polarity: 'wet' },
  ]);
  const agree = detectEvidenceConflict([
    { source: 'photo', axis: 'moisture', polarity: 'dry' },
    { source: 'soil reading', axis: 'moisture', polarity: 'dry' },
  ]);
  return Object.freeze({
    ok: true,
    detectsOpposite: conflict.hasConflict === true && conflict.recommendation === 'verify',
    ignoresAgreement: agree.hasConflict === false,
    singleSourceNoConflict: detectEvidenceConflict([{ source: 'photo', axis: 'moisture', polarity: 'dry' }]).hasConflict === false,
  });
}
