/**
 * scanUnclearReason.ts — turn a no-result scan into an HONEST, SPECIFIC reason +
 * next action, so the farmer never sees a generic "Scan unclear."
 *
 * Composes signals already on the scan result (image quality, provider status,
 * object type) — invents nothing. When no specific signal is available it still
 * returns a specific, honest fallback ("We couldn't read this photo clearly"), never
 * the banned generic phrase. Pure, total, language-neutral (key + English fallback).
 */
export interface UnclearReason {
  cause: 'too_dark' | 'blurry' | 'too_far' | 'multiple' | 'provider_down' | 'no_plant' | 'unreadable';
  headlineKey: string;
  headline: string;       // English fallback
  nextActionKey: string;
  nextAction: string;     // English fallback
}

const _isObj = (v: unknown): v is Record<string, any> => v != null && typeof v === 'object';
const _num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _low = (v: unknown): string => String(v == null ? '' : v).toLowerCase();

function _make(cause: UnclearReason['cause'], headline: string, nextAction: string): UnclearReason {
  return Object.freeze({
    cause,
    headlineKey: 'scan.unclear.' + cause + '.title',
    headline,
    nextActionKey: 'scan.unclear.' + cause + '.action',
    nextAction,
  });
}

/** Map the available failure signals to a specific reason. Never returns "Scan unclear". */
export function scanUnclearReason(result: unknown): UnclearReason {
  try {
    const r = _isObj(result) ? result : {};

    // 1. Image-quality problems — the most common + most fixable. Read defensively
    //    across the preflight shape ({hint, stats:{luminance,sharpness}}) and any
    //    server quality envelope ({label, issues[]}).
    const q = _isObj(r.imageQuality) ? r.imageQuality : (_isObj(r.qualityReport) ? r.qualityReport : {});
    const stats = _isObj((q as any).stats) ? (q as any).stats : q;
    const hint = _low((q as any).hint) + ' ' + _low((q as any).label) + ' ' + _low((q as any).reason) + ' '
               + (Array.isArray((q as any).issues) ? (q as any).issues.map(_low).join(' ') : '');
    const lum = _num((stats as any).luminance);
    const sharp = _num((stats as any).sharpness);

    if (lum != null && lum < 0.18 || /dark|low.?light|underexpos/.test(hint)) {
      return _make('too_dark', 'The photo is too dark', 'Use daylight or move to better light, then scan again.');
    }
    if (sharp != null && sharp < 0.25 || /blur|out of focus|motion/.test(hint)) {
      return _make('blurry', 'The photo is blurry', 'Hold the phone steady, tap the leaf to focus, then scan again.');
    }
    if (/\bfar\b|distance|too small|\bcloser\b|larger photo|zoom/.test(hint)) {
      return _make('too_far', 'The plant is too far away', 'Move closer and fill the frame with one leaf.');
    }
    if (/multiple|more than one|several plants/.test(hint)) {
      return _make('multiple', 'More than one plant is in view', 'Photograph just one leaf at a time.');
    }

    // 2. Provider unavailable — every identification provider failed to return a usable
    //    result (auth/credits/timeout/server). Distinct from "no plant in the photo".
    const ps = _isObj(r.providerStatuses) ? r.providerStatuses : {};
    const plantStatus = String((ps as any).plantId || '').toUpperCase();
    const DOWN = ['AUTH_FAILED', 'CREDITS_EXHAUSTED', 'RATE_LIMITED', 'TIMEOUT', 'SERVER_ERROR', 'NETWORK'];
    if (DOWN.includes(plantStatus) || (r as any).serviceUnavailable === true) {
      return _make('provider_down', 'The scan service is busy right now', 'Please try again in a few moments.');
    }

    // 3. The service worked but saw no plant (we explicitly looked — object marked
    //    unknown, or an empty candidate list came back).
    const objectType = _low(r.objectType);
    const emptyCandidateList = Array.isArray((r as any).topCandidates) && (r as any).topCandidates.length === 0;
    if (objectType === 'unknown' || emptyCandidateList) {
      return _make('no_plant', 'No plant was clearly visible', 'Point the camera at one whole leaf or the plant, filling the frame.');
    }

    // 4. Honest specific fallback — NEVER the generic "Scan unclear".
    return _make('unreadable', 'We couldn’t read this photo clearly', 'Take another clear photo of one leaf in daylight.');
  } catch {
    return _make('unreadable', 'We couldn’t read this photo clearly', 'Take another clear photo of one leaf in daylight.');
  }
}
