/**
 * resolveScanTerminalState — the canonical scan outcome state machine.
 *
 * P0 requirement: "A scan must ALWAYS end in one of these states … it must never
 * dead-end at 'Scan temporarily unavailable'." This pure, total function maps ANY
 * normalized scan outcome to exactly one of the 11 terminal states + a farmer-facing
 * message + the SAFETY LOCK flag (`mayMutateFarm`).
 *
 * Safety lock (P0): ONLY a confident SUCCESS_IDENTIFIED / SUCCESS_HEALTH_ISSUE may
 * mutate farm state. Every failure / low-confidence / queued state → mayMutateFarm=false
 * (never add plant / crop / task / FarmBrain / recommendation). This composes — it does
 * not replace — classifyProviderFailure + scanUnclearReason.
 *
 * Never throws.
 */
export type ScanTerminalState =
  | 'SUCCESS_IDENTIFIED' | 'SUCCESS_HEALTH_ISSUE' | 'BAD_IMAGE' | 'NO_PLANT_DETECTED'
  | 'LOW_CONFIDENCE' | 'PROVIDER_UNAVAILABLE' | 'AUTH_FAILED' | 'RATE_LIMITED'
  | 'UPLOAD_FAILED' | 'QUEUED_FOR_REVIEW' | 'SAVED_FOR_RETRY';

export interface ScanOutcome {
  ok?: boolean;                 // provider returned a usable result
  uploadFailed?: boolean;
  httpStatus?: number | null;
  serviceUnavailable?: boolean;
  failureReason?: string | null; // e.g. 'auth' | 'rate_limit' | 'timeout' | 'network' | 'bad_image' | 'no_plant' | 'malformed'
  reviewRequested?: boolean;    // human review queued
  queuedForRetry?: boolean;     // offline / background retry
  candidateCount?: number;
  confidenceTone?: string | null;   // 'high' | 'medium' | 'low' | 'needs_review'
  confidencePct?: number | null;    // 0..100
  hasHealthIssue?: boolean;     // disease / pest / nutrient / water stress
  imageQuality?: string | null; // 'bad' | 'blurry' | 'dark' | 'ok'
}

export interface ScanTerminalResult {
  state: ScanTerminalState;
  mayMutateFarm: boolean;
  canRetry: boolean;
  canUpload: boolean;
  canSaveForReview: boolean;
  messageKey: string;
  message: string;              // English fallback; UI resolves messageKey via tSafe
}

const _s = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');
const _n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function _isConfident(o: ScanOutcome): boolean {
  const tone = _s(o.confidenceTone);
  if (tone === 'high' || tone === 'medium' || tone === 'medium_confidence') return true;
  const pct = _n(o.confidencePct);
  if (pct != null && pct >= 40) return true;
  return false;
}

const MSG: Record<ScanTerminalState, [string, string]> = {
  SUCCESS_IDENTIFIED:   ['scan.state.identified',   'Here is what we found.'],
  SUCCESS_HEALTH_ISSUE: ['scan.state.healthIssue',  'We found something to check on your plant.'],
  BAD_IMAGE:            ['scan.state.badImage',     'The photo was hard to read. Try a clearer, closer photo in good light.'],
  NO_PLANT_DETECTED:    ['scan.state.noPlant',      'We could not find a plant in this photo. Try again with the leaf or plant filling the frame.'],
  LOW_CONFIDENCE:       ['scan.state.lowConfidence','We are not sure yet. Try another photo, or save it for an expert to review.'],
  PROVIDER_UNAVAILABLE: ['scan.state.busy',         'The scan service is busy right now. Your photo is saved — please try again shortly.'],
  AUTH_FAILED:          ['scan.state.busy',         'The scan service is busy right now. Your photo is saved — please try again shortly.'],
  RATE_LIMITED:         ['scan.state.busy',         'The scan service is busy right now. Your photo is saved — please try again shortly.'],
  UPLOAD_FAILED:        ['scan.state.uploadFailed', 'We could not send your photo. Check your connection and try again — your photo is saved.'],
  QUEUED_FOR_REVIEW:    ['scan.state.review',       'We saved your scan for an expert to review.'],
  SAVED_FOR_RETRY:      ['scan.state.retry',        'Your photo is saved. We will try again automatically when the connection is better.'],
};

/** Total: every input resolves to exactly one terminal state. Never throws. */
export function resolveScanTerminalState(outcome: ScanOutcome | null | undefined): ScanTerminalResult {
  const o: ScanOutcome = outcome && typeof outcome === 'object' ? outcome : {};
  let state: ScanTerminalState;

  const reason = _s(o.failureReason);
  const http = _n(o.httpStatus);

  if (o.uploadFailed === true || reason.includes('upload')) state = 'UPLOAD_FAILED';
  else if (o.reviewRequested === true) state = 'QUEUED_FOR_REVIEW';
  else if (o.queuedForRetry === true) state = 'SAVED_FOR_RETRY';
  else if (http === 401 || http === 403 || reason.includes('auth') || reason.includes('credit')) state = 'AUTH_FAILED';
  else if (http === 429 || reason.includes('rate')) state = 'RATE_LIMITED';
  else if (o.serviceUnavailable === true || reason.includes('timeout') || reason.includes('network')
           || reason.includes('provider_down') || reason.includes('unavailable') || (http != null && http >= 500))
    state = 'PROVIDER_UNAVAILABLE';
  else if (_s(o.imageQuality) === 'bad' || _s(o.imageQuality) === 'blurry' || _s(o.imageQuality) === 'dark'
           || reason.includes('bad_image') || reason.includes('blur') || reason.includes('quality'))
    state = 'BAD_IMAGE';
  else if (reason.includes('no_plant') || reason.includes('not_a_plant')
           || (o.ok !== true && (o.candidateCount === 0)) || reason.includes('empty'))
    state = 'NO_PLANT_DETECTED';
  else if (o.ok === true && _isConfident(o)) state = o.hasHealthIssue === true ? 'SUCCESS_HEALTH_ISSUE' : 'SUCCESS_IDENTIFIED';
  else if (o.ok === true) state = 'LOW_CONFIDENCE';
  else if (reason.includes('malformed') || reason.includes('parse') || reason.includes('invalid')) state = 'PROVIDER_UNAVAILABLE';
  else state = 'SAVED_FOR_RETRY'; // ultimate fallback — never a dead-end

  const isSuccess = state === 'SUCCESS_IDENTIFIED' || state === 'SUCCESS_HEALTH_ISSUE';
  const [messageKey, message] = MSG[state];
  return Object.freeze({
    state,
    mayMutateFarm: isSuccess,           // SAFETY LOCK — only confident success may mutate
    canRetry: state !== 'QUEUED_FOR_REVIEW',
    canUpload: !isSuccess,
    canSaveForReview: !isSuccess,
    messageKey,
    message,
  });
}

export default resolveScanTerminalState;
