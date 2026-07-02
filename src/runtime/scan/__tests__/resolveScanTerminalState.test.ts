/**
 * resolveScanTerminalState.test — every P0 scan scenario resolves to exactly one
 * terminal state, and the SAFETY LOCK holds (only confident success may mutate farm).
 * Self-running: `npx tsx …`.
 */
import { resolveScanTerminalState as R } from '../resolveScanTerminalState.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function is(o: any, state: string, m: string) { ok(R(o).state === state, m + ' → ' + state + ' (got ' + R(o).state + ')'); }

// ── never dead-ends: null/garbage → a real terminal state ──
is(null, 'SAVED_FOR_RETRY', 'null outcome');
is({}, 'SAVED_FOR_RETRY', 'empty outcome');

// ── provider failures ──
is({ httpStatus: 401 }, 'AUTH_FAILED', 'http 401');
is({ failureReason: 'credits' }, 'AUTH_FAILED', 'credits');
is({ httpStatus: 429 }, 'RATE_LIMITED', 'http 429');
is({ failureReason: 'rate_limit' }, 'RATE_LIMITED', 'rate limit');
is({ serviceUnavailable: true }, 'PROVIDER_UNAVAILABLE', 'serviceUnavailable');
is({ failureReason: 'timeout' }, 'PROVIDER_UNAVAILABLE', 'timeout');
is({ httpStatus: 503 }, 'PROVIDER_UNAVAILABLE', 'http 5xx');
is({ failureReason: 'malformed' }, 'PROVIDER_UNAVAILABLE', 'malformed response');

// ── upload + image ──
is({ uploadFailed: true }, 'UPLOAD_FAILED', 'upload failed');
is({ imageQuality: 'blurry' }, 'BAD_IMAGE', 'blurry image');
is({ failureReason: 'bad_image' }, 'BAD_IMAGE', 'bad image reason');
is({ ok: false, candidateCount: 0 }, 'NO_PLANT_DETECTED', 'empty candidates');
is({ failureReason: 'no_plant' }, 'NO_PLANT_DETECTED', 'no plant');

// ── success by type (crop/plant/flower/veg/fruit/weed all funnel through ok+confident) ──
is({ ok: true, confidenceTone: 'high' }, 'SUCCESS_IDENTIFIED', 'crop identified (high)');
is({ ok: true, confidencePct: 82 }, 'SUCCESS_IDENTIFIED', 'plant identified (82%)');
is({ ok: true, confidenceTone: 'medium' }, 'SUCCESS_IDENTIFIED', 'flower identified (medium)');
is({ ok: true, confidenceTone: 'high', hasHealthIssue: true }, 'SUCCESS_HEALTH_ISSUE', 'disease suspected');

// ── low confidence blocked ──
is({ ok: true, confidenceTone: 'low' }, 'LOW_CONFIDENCE', 'low confidence');
is({ ok: true, confidencePct: 20 }, 'LOW_CONFIDENCE', 'low pct');

// ── queued ──
is({ reviewRequested: true }, 'QUEUED_FOR_REVIEW', 'saved for review');
is({ queuedForRetry: true }, 'SAVED_FOR_RETRY', 'queued for retry');

// ── SAFETY LOCK: only confident success may mutate farm ──
ok(R({ ok: true, confidenceTone: 'high' }).mayMutateFarm === true, 'confident success may mutate');
ok(R({ ok: true, confidenceTone: 'high', hasHealthIssue: true }).mayMutateFarm === true, 'health-issue success may mutate');
for (const bad of [null, {}, { ok: true, confidenceTone: 'low' }, { serviceUnavailable: true }, { uploadFailed: true },
  { reviewRequested: true }, { httpStatus: 429 }, { failureReason: 'no_plant' }, { imageQuality: 'bad' }]) {
  ok(R(bad as any).mayMutateFarm === false, 'failed/low/queued must NOT mutate: ' + JSON.stringify(bad));
}

// ── recovery affordances present on every non-success state ──
for (const bad of [{}, { serviceUnavailable: true }, { uploadFailed: true }, { ok: true, confidenceTone: 'low' }]) {
  const r = R(bad as any);
  ok(r.canUpload && r.canSaveForReview && typeof r.message === 'string' && r.message.length > 0,
    'non-success offers recovery + a farmer message: ' + JSON.stringify(bad));
}

console.log('[resolveScanTerminalState] PASS — ' + passed + ' assertions. Every scan ends in one of 11 '
  + 'terminal states (never a dead-end); safety lock lets only confident success mutate farm state.');
