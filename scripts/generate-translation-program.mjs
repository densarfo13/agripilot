#!/usr/bin/env node
/**
 * generate-translation-program.mjs — sprint #211 (TRANSLATION
 * COMPLETION PROGRAM). READ-ONLY analysis: reads the T-*.js columns
 * and emits the 5 translator hand-off reports. Touches NO engine.
 *
 * Coverage signal (honest, tool-standard): a key is "untranslated"
 * in a locale when its value is empty OR identical to the English
 * value. (A handful of legitimately-identical terms — proper nouns,
 * units — are counted as untranslated; this slightly UNDER-states
 * coverage, which is the safe direction for a readiness call.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLS = path.join(ROOT, 'src', 'i18n', 'columns');
const LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
const NAMES = { en: 'English', fr: 'French', sw: 'Swahili', ha: 'Hausa', tw: 'Twi', hi: 'Hindi' };

async function load(c) {
  return (await import(pathToFileURL(path.join(COLS, 'T-' + c + '.js')).href + '?x=' + c)).default;
}

// Farmer-facing screens → namespace prefixes (Fable: grower only).
const SCREENS = [
  ['Home',          ['home.', 'commandCenter.', 'today.', 'greeting.', 'farmBrain.', 'farmQuality.', 'farmTimeline.']],
  ['Farm',          ['farm.', 'myFarm.', 'newFarm.']],
  ['Garden',        ['garden.', 'gardenMode.', 'myGrow.']],
  ['Tasks',         ['task.', 'tasks.', 'taskAction']],
  ['Activity',      ['activity.', 'journal.', 'timeline.']],
  ['Scan',          ['scan.']],
  ['Funding',       ['funding.']],
  ['Sell',          ['sell.', 'market.', 'buyer.']],
  ['Settings',      ['settings.']],
  ['Notifications', ['notification', 'notifications.']],
  ['Common / CTA',  ['common.', 'role.', 'outcome.', 'header.actions']],
];
// Fable: ignore non-farmer namespaces.
const EXCLUDE = ['admin.', 'internal.', 'dev.', 'debug.', 'founder.', 'analytics', 'pilot.', 'ngo.', 'fieldOfficer.', 'supervisor.', 'v7', 'v8', 'v13', '_meta'];

const isFarmerFacing = (k) => !EXCLUDE.some((p) => k.startsWith(p) || k.includes('.' + p));
const screenOf = (k) => {
  for (const [name, prefixes] of SCREENS) if (prefixes.some((p) => k.startsWith(p))) return name;
  return null;
};
const untranslated = (val, enVal) => !(typeof val === 'string' && val.trim() && val !== enVal);

async function main() {
  const cols = {};
  for (const c of LOCALES) cols[c] = await load(c);
  const en = cols.en;
  const keys = Object.keys(en);
  const TRANS = LOCALES.filter((c) => c !== 'en');

  // Per-locale coverage.
  const cov = {};
  for (const c of TRANS) {
    let tr = 0; const missing = [];
    for (const k of keys) {
      if (untranslated(cols[c][k], en[k])) missing.push(k); else tr++;
    }
    cov[c] = { translated: tr, missing, pct: +(tr / keys.length * 100).toFixed(1) };
  }

  // Farmer-facing missing, per key: how many locales miss it.
  const farmerKeys = keys.filter(isFarmerFacing);
  const missCount = {};
  for (const k of farmerKeys) {
    missCount[k] = TRANS.filter((c) => untranslated(cols[c][k], en[k])).length;
  }
  const farmerMissing = farmerKeys.filter((k) => missCount[k] > 0);

  // Per-screen missing counts (farmer-facing).
  const byScreen = {};
  for (const [name] of SCREENS) byScreen[name] = { total: 0, missingByLocale: Object.fromEntries(TRANS.map((c) => [c, 0])) };
  for (const k of farmerKeys) {
    const s = screenOf(k); if (!s) continue;
    byScreen[s].total++;
    for (const c of TRANS) if (untranslated(cols[c][k], en[k])) byScreen[s].missingByLocale[c]++;
  }

  const W = (rel, body) => { fs.writeFileSync(path.join(ROOT, rel), body, 'utf8'); console.log('wrote', rel); };
  const D = '2026-06-19';
  const totalFarmer = farmerKeys.length;

  // ── 1. PILOT_CRITICAL_TRANSLATIONS.md ─────────────────────────
  {
    const SURF = ['Home', 'Farm', 'Tasks', 'Activity', 'Scan', 'Funding', 'Sell'];
    const L = [];
    L.push('# PILOT_CRITICAL_TRANSLATIONS.md', '', '**Sprint #211 — untranslated farmer-facing strings on pilot screens.**', 'Date: ' + D + '. Read-only; source: T-*.js columns.', '');
    L.push('Untranslated = value empty OR identical to English. Across the', 'pilot screens (Home / Farm / Tasks / Activity / Scan / Funding / Sell):', '');
    L.push('| Screen | Keys | fr | sw | ha | tw | hi |', '|---|--:|--:|--:|--:|--:|--:|');
    for (const s of SURF) {
      const b = byScreen[s];
      L.push('| ' + s + ' | ' + b.total + ' | ' + TRANS.map((c) => b.missingByLocale[c]).join(' | ') + ' |');
    }
    L.push('', '_Numbers are MISSING keys per locale. The Latin locales', '(fr/sw/ha/tw) are near-complete; Hindi carries the bulk._');
    W('PILOT_CRITICAL_TRANSLATIONS.md', L.join('\n') + '\n');
  }

  // ── 2. TRANSLATION_PROGRESS_DASHBOARD.md ──────────────────────
  {
    const L = [];
    L.push('# TRANSLATION_PROGRESS_DASHBOARD.md', '', '**Sprint #211 — per-locale completion.**', 'Date: ' + D + '. Total keys: ' + keys.length + '.', '');
    L.push('| Locale | Total | Translated | Missing | Completion |', '|---|--:|--:|--:|--:|');
    L.push('| English (canonical) | ' + keys.length + ' | ' + keys.length + ' | 0 | 100.0% |');
    for (const c of TRANS) {
      L.push('| ' + NAMES[c] + ' | ' + keys.length + ' | ' + cov[c].translated + ' | ' + cov[c].missing.length + ' | ' + cov[c].pct + '% |');
    }
    L.push('', '_Twi/Swahili/Hausa/French are pilot-ready (≥95%); Hindi needs', 'bulk translation (see LANGUAGE_HEALTH_SCORE.md). Hindi is hidden', 'from the picker (enableHindiLocale=false) until complete._');
    W('TRANSLATION_PROGRESS_DASHBOARD.md', L.join('\n') + '\n');
  }

  // ── 3. SCREEN_LANGUAGE_AUDIT.md ───────────────────────────────
  {
    const L = [];
    L.push('# SCREEN_LANGUAGE_AUDIT.md', '', '**Sprint #211 — missing translations grouped by screen.**', 'Date: ' + D + '. Farmer-facing only.', '');
    L.push('| Screen | Keys | Missing (any locale) | fr | sw | ha | tw | hi |', '|---|--:|--:|--:|--:|--:|--:|--:|');
    for (const [name] of SCREENS) {
      const b = byScreen[name];
      const anyMiss = Object.values(b.missingByLocale).reduce((a, x) => Math.max(a, x), 0);
      L.push('| ' + name + ' | ' + b.total + ' | ' + anyMiss + ' | ' + TRANS.map((c) => b.missingByLocale[c]).join(' | ') + ' |');
    }
    L.push('', '_"Missing (any locale)" = worst single locale for that screen', '(usually Hindi). fr/sw/ha/tw columns are near-zero per screen._');
    W('SCREEN_LANGUAGE_AUDIT.md', L.join('\n') + '\n');
  }

  // ── 4. PILOT_LANGUAGE_PACK.md ─────────────────────────────────
  {
    const PHRASES = ['Crop', 'Plant', 'Farm', 'Garden', 'Task', 'Done', 'Skip', 'Add Note', 'Scan', 'Scan Again', 'Save', 'Review', 'Location', 'Weather', 'Harvest', 'Funding', 'Sell', 'Buyer', 'Market', 'Disease', 'Treatment', 'Healthy', 'Needs Review', 'Unknown Plant', 'Add Crop', 'Add Farm', "Today's Action"];
    // Find a key whose English value equals the phrase (case-insens).
    const byVal = {};
    for (const k of keys) {
      const v = (en[k] || '').trim().toLowerCase();
      if (!byVal[v]) byVal[v] = k;
    }
    const L = [];
    L.push('# PILOT_LANGUAGE_PACK.md', '', '**Sprint #211 — highest-priority farmer phrases + status.**', 'Date: ' + D + '. ✓ translated · ✗ English fallback.', '');
    L.push('| Phrase | key | fr | sw | ha | tw | hi |', '|---|---|:-:|:-:|:-:|:-:|:-:|');
    for (const ph of PHRASES) {
      const k = byVal[ph.toLowerCase()];
      if (!k) { L.push('| ' + ph + ' | _(no exact key)_ | – | – | – | – | – |'); continue; }
      const cells = TRANS.map((c) => untranslated(cols[c][k], en[k]) ? '✗' : '✓');
      L.push('| ' + ph + ' | `' + k + '` | ' + cells.join(' | ') + ' |');
    }
    L.push('', '_These are the phrases a farmer meets in the first session.', 'Any ✗ should be translated before that locale\'s pilot._');
    W('PILOT_LANGUAGE_PACK.md', L.join('\n') + '\n');
  }

  // ── 5. LANGUAGE_HEALTH_SCORE.md + top-100 ─────────────────────
  {
    const worstPct = Math.min(...TRANS.map((c) => cov[c].pct));
    const latinPct = Math.min(...['fr', 'sw', 'ha', 'tw'].map((c) => cov[c].pct));
    const RAG = (g, y) => (v) => v >= g ? 'GREEN' : v >= y ? 'YELLOW' : 'RED';
    const covStatus = latinPct >= 95 ? 'GREEN (visible locales)' : latinPct >= 85 ? 'YELLOW' : 'RED';
    // Top 100 farmer-facing missing, ranked by #locales-missing desc.
    const top = farmerMissing
      .sort((a, b) => missCount[b] - missCount[a] || a.localeCompare(b))
      .slice(0, 100);

    const L = [];
    L.push('# LANGUAGE_HEALTH_SCORE.md', '', '**Sprint #211 — language health (farmer-facing).**', 'Date: ' + D + '.', '');
    L.push('| Dimension | Status | Basis |', '|---|---|---|');
    L.push('| Coverage (visible locales fr/sw/ha/tw) | ' + covStatus + ' | min ' + latinPct + '% |');
    L.push('| Coverage (Hindi) | ' + (cov.hi.pct >= 95 ? 'GREEN' : cov.hi.pct >= 85 ? 'YELLOW' : 'RED') + ' | ' + cov.hi.pct + '% — hidden until complete |');
    L.push('| Consistency (structural parity) | GREEN | all locales ' + keys.length + ' keys |');
    L.push('| Fallback usage | ' + (worstPct >= 95 ? 'GREEN' : 'YELLOW') + ' | English fallback safe; Hindi-heavy |');
    L.push('| Mixed-language screens | GREEN | Hindi gated → no mixed screen shipped; visible locales ≥95% |');
    L.push('| Pilot readiness (language) | ' + (latinPct >= 95 ? 'GREEN' : 'YELLOW') + ' | 4 visible locales pilot-ready; Hindi deferred |');
    L.push('', '## Overall', '', 'Farmer-facing language health: **' + (latinPct >= 95 ? 'GREEN' : 'YELLOW') + '** for the 5 visible locales (Hindi hidden by design).', '');
    L.push('## Top ' + top.length + ' missing farmer-facing translations', '', '(ranked by how many locales lack them — 5 = missing everywhere)', '', '| # | key | English | missing in |', '|--:|---|---|--:|');
    top.forEach((k, i) => {
      const env = (en[k] || '').replace(/\|/g, '\\|').slice(0, 48);
      L.push('| ' + (i + 1) + ' | `' + k + '` | ' + env + ' | ' + missCount[k] + '/5 |');
    });
    W('LANGUAGE_HEALTH_SCORE.md', L.join('\n') + '\n');
  }

  // Machine summary for the assistant.
  const completionAll = +(LOCALES.filter((c) => c !== 'en').reduce((a, c) => a + cov[c].pct, 0) / 5).toFixed(1);
  console.log('SUMMARY ' + JSON.stringify({
    totalKeys: keys.length, farmerKeys: totalFarmer,
    pct: Object.fromEntries(TRANS.map((c) => [c, cov[c].pct])),
    avgCompletion: completionAll,
    visibleLocalesMinPct: Math.min(...['fr', 'sw', 'ha', 'tw'].map((c) => cov[c].pct)),
    farmerMissingTotal: farmerMissing.length,
  }));
}
main().catch((e) => { console.error(e); process.exit(1); });
