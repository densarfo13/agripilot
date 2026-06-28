/**
 * scanUnclearReason.test.ts — every no-result scan gets a SPECIFIC honest reason +
 * next action, never the generic "Scan unclear". `tsx scanUnclearReason.test.ts`.
 */
import { scanUnclearReason } from '../scanUnclearReason';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const dark = scanUnclearReason({ imageQuality: { stats: { luminance: 0.1 } } });
ok(dark.cause === 'too_dark' && /dark/i.test(dark.headline), 'low luminance → too_dark');

const blur = scanUnclearReason({ imageQuality: { stats: { sharpness: 0.1 } } });
ok(blur.cause === 'blurry' && /blur/i.test(blur.headline), 'low sharpness → blurry');

const far = scanUnclearReason({ imageQuality: { hint: 'Move a little closer or use a larger photo' } });
ok(far.cause === 'too_far' && /closer|leaf/i.test(far.nextAction), 'far hint → too_far');

const down = scanUnclearReason({ providerStatuses: { plantId: 'AUTH_FAILED' } });
ok(down.cause === 'provider_down' && /try again/i.test(down.nextAction), 'provider auth fail → provider_down (try again)');

const timeout = scanUnclearReason({ serviceUnavailable: true });
ok(timeout.cause === 'provider_down', 'serviceUnavailable → provider_down');

const noPlant = scanUnclearReason({ objectType: 'unknown', topCandidates: [] });
ok(noPlant.cause === 'no_plant' && /leaf|plant/i.test(noPlant.nextAction), 'unknown object → no_plant');

const empty = scanUnclearReason({});
ok(empty.cause === 'unreadable', 'empty → honest unreadable fallback');
const nul = scanUnclearReason(null);
ok(nul.cause === 'unreadable', 'null → unreadable (never throws)');

// THE headline guarantee: no result EVER yields the banned generic phrase.
for (const r of [dark, blur, far, down, timeout, noPlant, empty, nul]) {
  ok(!/scan unclear/i.test(r.headline) && !/scan unclear/i.test(r.nextAction), 'never the generic "Scan unclear": ' + r.cause);
  ok(r.headline.length > 0 && r.nextAction.length > 0, 'has headline + next action: ' + r.cause);
  ok(/^scan\.unclear\./.test(r.headlineKey) && /^scan\.unclear\./.test(r.nextActionKey), 'carries translation keys: ' + r.cause);
}

console.log('[test:scan-unclear-reason] PASS — ' + passed + ' assertions (every no-result scan gets a specific honest reason + next action; never the generic "Scan unclear").');
