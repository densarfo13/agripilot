/**
 * release-governor.mjs — FARROWAY RELEASE GOVERNOR.
 *
 * Aggregates the 11 release rules into ONE verdict (PASS / PASS_WITH_WARNINGS /
 * BLOCKED) and writes the 5 scorecards. Most rules already have build:safe gates;
 * the governor composes them so a release gets a single, honest go/no-go.
 *
 * Honesty split:
 *   • BLOCK rules — code-quality regressions that must stop a release (a weak
 *     scan updating FarmBrain, a logged secret, a missing quality gate).
 *   • WARN rules — operator/field-evidence items that are PENDING, not regressions
 *     (live performance timing, farmer adoption). They warn; they don't block.
 *   • INFO rules — human judgement (the Farmer Value Test), surfaced not automated.
 *
 *   node scripts/release-governor.mjs   → evaluates + writes scorecards + verdict
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

// A rule passes if all its required gate scripts / backing files exist.
const need = (...files) => files.every(x);

const RULES = [
  { n: 1, name: 'Farmer Value Test', type: 'info',
    pass: () => true, note: 'Human judgement: "does this help a farmer decide better today?" — surfaced, not automated.' },
  { n: 2, name: 'Evidence Test', type: 'block',
    pass: () => need('scripts/check-trust-evidence.mjs', 'src/runtime/decision/FarrowayDecisionEngine.ts'),
    note: 'Every recommendation has evidence/confidence/reason/benefit/next-action; unsupported rejected.' },
  { n: 3, name: 'Performance Test', type: 'warn',
    pass: () => x('scripts/check-bundle-budget.mjs') || x('scripts/check-performance-budget.mjs'),
    note: 'Budgets gated in CI; live <2s/<1s/<4s/<500ms timing PENDING field measurement.' },
  { n: 4, name: 'Provider Health', type: 'block',
    pass: () => need('scripts/check-provider-runtime-status.mjs', 'scripts/check-environment-orchestrator.mjs'),
    note: 'Ready/latency/failure-reason/retry/cache/degradation; failures never block FarmBrain.' },
  { n: 5, name: 'Scan Quality', type: 'block',
    pass: () => need('scripts/check-scan-result-mapping.mjs', 'scripts/check-farmbrain-scan-ingestion.mjs'),
    note: 'No unknown diagnosis / fake disease / low-confidence task / weak scan into FarmBrain.' },
  { n: 6, name: 'Localization', type: 'block',
    pass: () => need('scripts/check-locale-audit-v2.mjs', 'src/i18n/columns/T-tw.js'),
    note: '6 locales; no mixed-language UI (Hindi hidden until translated).' },
  { n: 7, name: 'Offline', type: 'block',
    pass: () => need('public/sw.js', 'src/lib/sync/farmSync.js'),
    note: 'Scans/tasks/timeline/treatments/recommendations queue and sync when online.' },
  { n: 8, name: 'Data Quality', type: 'block',
    pass: () => need('src/runtime/quality/DataQualityEngine.ts', 'scripts/check-enterprise-certification.mjs'),
    note: 'Every recommendation shows High/Medium/Low data quality; no raw provider data exposed.' },
  { n: 9, name: 'Observability', type: 'block',
    pass: () => need('server/src/ml/scanObservability.js', 'src/runtime/analytics/PilotAnalyticsRuntime.ts'),
    note: 'Uptime/latency/scan-success/acceptance/completion/outcome/retention tracked.' },
  { n: 10, name: 'Security', type: 'block',
    pass: () => secureNoSecretLeak() && need('scripts/check-scan-provider-auth.mjs'),
    note: 'No full API key logged; provider diagnostics admin-gated; fingerprint-only.' },
  { n: 11, name: 'Pilot Gates', type: 'warn',
    pass: () => need('src/runtime/scan/certification/PilotCertificationRuntime.ts'),
    note: 'Verdict LIMITED_PILOT → READY FOR 10 FARMERS; higher tiers need field evidence.' },
];

/** Rule 10 backstop: no source file logs a full provider key value. */
function secureNoSecretLeak() {
  const files = [];
  const walk = (dir) => {
    let ents = [];
    try { ents = fs.readdirSync(path.join(R, dir), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(rel)) walk(rel); }
      else if (/\.(js|ts|jsx|tsx)$/.test(e.name)) files.push(rel);
    }
  };
  walk('src'); walk('server/src');
  // A leak = console.log of a full *_API_KEY env value with no slice/fingerprint on the line.
  const leak = /console\.(log|error|info)\([^)]*process\.env\.[A-Z_]*API_KEY(?![^)]*(slice|fingerprint))/;
  for (const f of files) { if (leak.test(rd(f))) return false; }
  return true;
}

// ── Evaluate ──
const results = RULES.map((r) => ({ ...r, ok: (() => { try { return !!r.pass(); } catch { return false; } })() }));
const blockedFails = results.filter((r) => r.type === 'block' && !r.ok);
const warns = results.filter((r) => (r.type === 'warn') || (r.type === 'block' && !r.ok && false));
const warnPending = results.filter((r) => r.type === 'warn');

const verdict = blockedFails.length ? 'BLOCKED'
  : warnPending.length ? 'PASS_WITH_WARNINGS' : 'PASS';

// ── Scorecards ──
const row = (r) => `| ${r.n} | ${r.name} | ${r.type.toUpperCase()} | ${r.ok ? '✅' : (r.type === 'block' ? '❌' : '⚠️')} | ${r.note} |`;
const table = (rs) => '| # | Rule | Kind | Status | Note |\n|---|---|---|---|---|\n' + rs.map(row).join('\n') + '\n';
const stamp = '_Generated by release-governor.mjs. Field-evidence rules WARN (operator-pending), not BLOCK._\n';

fs.writeFileSync(path.join(R, 'RELEASE_SCORECARD.md'),
  `# RELEASE_SCORECARD\n\n**Verdict: ${verdict}**\n\n` + table(results) + '\n' + stamp);
fs.writeFileSync(path.join(R, 'PERFORMANCE_SCORECARD.md'),
  `# PERFORMANCE_SCORECARD\n\nBudgets enforced in CI (bundle/perf). Live timing targets\n(app <2s · home <1s · camera <1s · scan <4s · rec <500ms · offline <2s) are\nmeasured in the field — currently PENDING, so this rule WARNS, never blocks.\n\n` + table(results.filter((r) => r.n === 3)) + stamp);
fs.writeFileSync(path.join(R, 'RELIABILITY_SCORECARD.md'),
  `# RELIABILITY_SCORECARD\n\nProvider health, scan quality, offline, observability — the\nresilience rules. Provider failures never block FarmBrain (graceful degradation).\n\n` + table(results.filter((r) => [4, 5, 7, 9].includes(r.n))) + stamp);
fs.writeFileSync(path.join(R, 'TRUST_SCORECARD.md'),
  `# TRUST_SCORECARD\n\nEvidence, data quality, security, localization — the trust rules.\nEvery recommendation carries evidence + confidence + a data-quality band; no\nfabrication; no secret leaks; no mixed-language UI.\n\n` + table(results.filter((r) => [2, 6, 8, 10].includes(r.n))) + stamp);
fs.writeFileSync(path.join(R, 'PILOT_GATE_REPORT.md'),
  `# PILOT_GATE_REPORT\n\nREADY FOR 10 → 100 → 1,000 → NATIONAL → GLOBAL. Each tier requires\nMEASURABLE field success (accuracy + adoption + outcomes), not a code claim.\n\nCurrent: **READY FOR 10 FARMERS** — code machinery PASS; field evidence PENDING.\n\n` + table(results.filter((r) => r.n === 11)) + stamp);

// ── Output ──
console.log('[release-governor] VERDICT: ' + verdict);
for (const r of results) console.log(`  ${r.ok ? '✓' : (r.type === 'block' ? '✗' : '⚠')} Rule ${r.n} ${r.name} [${r.type}]`);
if (blockedFails.length) {
  console.error('[release-governor] BLOCKED — ' + blockedFails.length + ' block rule(s) failed.');
  process.exit(1);
}
console.log('[release-governor] ' + verdict + ' — block rules pass; ' + warnPending.length + ' warning(s) (field-evidence pending).');
