/**
 * check-scan-credit-monitor.mjs — sprint #225.
 * Locks the Kindwise scan-credit monitor: 3 providers tracked, the three
 * alert thresholds (<100/<50/<20), the admin endpoint + card, burn-rate
 * logging, and the honesty rules (no fabricated 0, key value never exposed).
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const SVC = 'server/src/ml/scanCreditMonitor.js';
if (!x(SVC)) E.push('missing: ' + SVC); else { const s = rd(SVC);
  h(s, 'export async function getScanCredits', 'must export getScanCredits');
  h(s, 'export async function refreshScanCredits', 'must export refreshScanCredits');
  // Three providers tracked.
  for (const p of ['plant.id', 'crop.health', 'insect.id']) h(s, p, 'must track provider host: ' + p);
  // Three alert thresholds.
  for (const t of ['low: 100', 'warning: 50', 'critical: 20']) h(s, t, 'must define threshold: ' + t);
  h(s, 'usage_info', 'must read usage_info (read-only; does not spend credits)');
  h(s, 'dailyBurn', 'must compute daily burn rate');
  h(s, 'daysRemaining', 'must compute estimated days remaining');
  h(s, '[scan.credits]', 'must log a structured burn/days line');
  // Honesty: never fabricate, never expose the key value.
  if (/remaining:\s*0\b/.test(s)) E.push('must NOT default remaining to 0 (honest null, not fake 0)');
  if (/console\.(log|warn|error)\([^)]*process\.env\.(PLANT_ID_API_KEY|PLANT_API_KEY|CROP_HEALTH_API_KEY|INSECT_ID_API_KEY)/.test(s))
    E.push('must NEVER log a key value');
}

const APP = 'server/src/app.js';
if (!x(APP)) E.push('missing: ' + APP); else { const s = rd(APP);
  h(s, "'/api/admin/scan-credits'", 'must mount GET /api/admin/scan-credits');
  h(s, 'getScanCredits', 'endpoint must call getScanCredits');
}

const CARD = 'src/components/admin/ScanCreditCard.jsx';
if (!x(CARD)) E.push('missing: ' + CARD); else { const s = rd(CARD);
  h(s, '/api/admin/scan-credits', 'card must fetch the credits endpoint');
  h(s, 'scan-credit-card', 'card must carry the scan-credit-card testid');
  for (const lvl of ['critical', 'warning', 'low']) h(s, lvl, 'card must render alert level: ' + lvl);
}
h(rd('src/pages/admin/ScanHealthPage.jsx'), 'ScanCreditCard', 'ScanHealthPage must mount ScanCreditCard');

if (E.length) { console.error('[check:scan-credit-monitor] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-credit-monitor] PASS — 3 providers, 3 thresholds, admin endpoint + card, burn/days logging; no fake 0, key value never logged.');
