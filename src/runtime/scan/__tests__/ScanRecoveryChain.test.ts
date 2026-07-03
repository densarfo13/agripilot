/**
 * ScanRecoveryChain.test — the self-healing chain: farmer presses Scan once; every
 * recovery transition is automatic; the chain never dead-ends and never throws.
 * Self-running: `npx tsx …`.
 */
import { runScanRecoveryChain, PROGRESS } from '../ScanRecoveryChain.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
const good = { ok: true, confidenceTone: 'high', result: { plantName: 'Maize' } };

(async () => {
  // primary succeeds → done, one provider call
  let r = await runScanRecoveryChain({}, { primary: async () => good });
  ok(r.terminal.state === 'SUCCESS_IDENTIFIED' && r.result != null, 'primary success → SUCCESS_IDENTIFIED + result');
  ok(!r.stagesTried.includes('secondary'), 'no secondary when primary succeeds');

  // transient failure → automatic retry succeeds
  let calls = 0;
  r = await runScanRecoveryChain({}, { primary: async () => (++calls === 1 ? { ok: false, failureReason: 'timeout' } : good) });
  ok(r.terminal.state === 'SUCCESS_IDENTIFIED' && calls === 2, 'transient timeout → auto-retry succeeds');

  // terminal failure (auth) → NO wasteful retry → secondary succeeds
  calls = 0;
  r = await runScanRecoveryChain({}, {
    primary: async () => { calls++; return { ok: false, failureReason: 'auth' }; },
    secondary: async () => good,
  });
  ok(calls === 1 && r.terminal.state === 'SUCCESS_IDENTIFIED', 'terminal auth → no retry, secondary succeeds');

  // everything fails → queued for retry (photo kept, never dead-end)
  r = await runScanRecoveryChain({}, {
    primary: async () => ({ ok: false, serviceUnavailable: true }),
    secondary: async () => ({ ok: false, failureReason: 'no_candidates' }),
    queue: async () => ({ ok: true }),
  });
  ok(r.terminal.state === 'SAVED_FOR_RETRY', 'all providers fail → SAVED_FOR_RETRY via queue');
  ok(r.terminal.mayMutateFarm === false, 'queued outcome cannot mutate farm');

  // even the queue fails → QUEUED_FOR_REVIEW (ultimate fallback, still not a dead-end)
  r = await runScanRecoveryChain({}, {
    primary: async () => ({ ok: false, failureReason: 'network' }),
    queue: async () => ({ ok: false }),
  });
  ok(r.terminal.state === 'QUEUED_FOR_REVIEW', 'queue fails too → QUEUED_FOR_REVIEW');

  // a stage that THROWS is a stage failure, not a chain crash
  r = await runScanRecoveryChain({}, {
    primary: async () => { throw new Error('boom'); },
    secondary: async () => good,
  });
  ok(r.terminal.state === 'SUCCESS_IDENTIFIED', 'primary throw → chain continues to secondary');

  // bad image is terminal BAD_IMAGE (protects provider credits; retake offered)
  r = await runScanRecoveryChain({}, {
    validate: async () => ({ ok: false, imageQuality: 'blurry' }),
    primary: async () => good,
  });
  ok(r.terminal.state === 'BAD_IMAGE' && r.terminal.canRetry, 'bad image → BAD_IMAGE, retake offered');

  // progress messages emitted in order, farmer-safe copy
  const msgs: string[] = [];
  await runScanRecoveryChain({}, {
    primary: async () => ({ ok: false, failureReason: 'network' }),
    secondary: async () => ({ ok: false }),
    queue: async () => ({ ok: true }),
  }, (p) => msgs.push(p.key));
  ok(msgs[0] === PROGRESS.checking.key && msgs.includes(PROGRESS.second.key), 'reassurance messages emitted in order');
  ok(Object.values(PROGRESS).every((p) => !/provider|API|error|pipeline/i.test(p.message)), 'no technical wording in progress copy');

  // garbage stages → still a named terminal state, never throws
  r = await runScanRecoveryChain(null, { primary: (() => null) as any });
  ok(typeof r.terminal.state === 'string' && r.terminal.message.length > 0, 'garbage input → named terminal state');

  console.log('[ScanRecoveryChain] PASS — ' + passed + ' assertions. One tap → automatic validate/repair/'
    + 'retry/secondary/queue/review chain; never dead-ends, never throws, farmer-safe progress copy.');
})();
