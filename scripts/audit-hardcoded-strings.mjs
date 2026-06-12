#!/usr/bin/env node
/**
 * audit-hardcoded-strings.mjs — sprint #187 second-pass.
 *
 * Heuristic scanner for English strings that bypass i18n on the
 * 16 grower-facing surfaces from the spec. Report-only; never
 * mutates source. Findings flow into HARDCODED_STRINGS_AUDIT.md.
 *
 * What it flags:
 *   - JSX text nodes: `>Some English Text<` between tags
 *   - Prop literals: `placeholder="…"`, `aria-label="…"`,
 *     `title="…"`, `alt="…"`, `label="…"` with English text
 *
 * What it skips (heuristic):
 *   - Strings that are template values (contain `{…}`)
 *   - Strings already wrapped in tSafe(…), t(…), tStrict(…)
 *   - data-* attributes (testids + data-attrs)
 *   - className / style / variant / size / type props
 *   - Strings < 3 chars or > 120 chars
 *   - Pure numeric / pure punctuation
 *   - Comments (// and /* … *​/ and {/* … *​/})
 *
 * Limitations (honestly stated):
 *   - Regex-based, not AST — false positives possible (e.g. test
 *     fixture text inside narrow templates).
 *   - Misses string-template uses of literals: `${'Hello'}`.
 *   - Does not check whether the string is grower-FACING vs
 *     admin-only — callers should review.
 *
 * Run:
 *   node scripts/audit-hardcoded-strings.mjs
 *   node scripts/audit-hardcoded-strings.mjs --json    # JSON output
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const asJson = process.argv.includes('--json');

// 16 grower-facing surfaces from the spec. Mix of pages and the
// canonical components they render. Admin / internal / NGO routes
// excluded — those are reviewer-facing.
const TARGETS = [
  // Home
  'src/pages/Home.jsx',
  'src/components/simpleMode/SimpleHome.jsx',
  // Tasks
  'src/pages/AllTasksPage.jsx',
  'src/modes/simple/SimpleTasks.jsx',
  // Notifications
  'src/components/NotificationBell.jsx',
  'src/pages/NotificationsPage.jsx',
  // Scan + Scan Results
  'src/components/scan/IntelligentScanResult.jsx',
  'src/components/scan/ScanCommandCard.jsx',
  'src/pages/ScanResultPage.jsx',
  'src/pages/ScanPage.jsx',
  // Today's Action
  'src/components/home/TodaysActionCard.jsx',
  // My Farm
  'src/pages/farmer/MyFarmPage.jsx',
  // My Grow / Garden
  'src/pages/MyPlants.jsx',
  // Journal
  'src/pages/JournalPage.jsx',
  // Funding
  'src/pages/ngo/FundingReadiness.jsx',
  // Sell
  'src/pages/SellPage.jsx',
  // Profile
  'src/pages/ProfileSetupPage.jsx',
  // Settings
  'src/components/system/SettingsDrawer.jsx',
  // Login + Signup
  'src/pages/Login.jsx',
  'src/pages/FarmerRegisterPage.jsx',
  // Onboarding
  'src/pages/onboarding/FastOnboarding.jsx',
];

function stripComments(src) {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
  return s;
}

// Look for English-ish strings.
function looksEnglish(s) {
  if (!s || s.length < 3 || s.length > 120) return false;
  if (/[{}]/.test(s)) return false;             // contains template
  if (!/[A-Za-z]/.test(s)) return false;        // no letters
  if (/^[\s\d.,:!?@#$%^&*()_+\-=[\]{}\\|;'"<>/]+$/.test(s)) return false;
  if (/^\$\{/.test(s)) return false;
  // Must contain a space OR start with a capital letter (single-word
  // labels like "Submit" should still flag).
  return /\s/.test(s) || /^[A-Z][a-z]/.test(s);
}

// Skip prop values that are not user-facing copy.
const NON_COPY_PROPS = new Set([
  'className', 'style', 'variant', 'size', 'type', 'role', 'as',
  'name', 'id', 'key', 'ref', 'href', 'src', 'to', 'route', 'rel',
  'target', 'method', 'autoComplete', 'autoCapitalize', 'autoCorrect',
  'spellCheck', 'inputMode', 'enterKeyHint', 'pattern', 'src',
  'crossOrigin', 'referrerPolicy', 'loading', 'decoding',
  'color', 'fill', 'stroke', 'transform', 'd', 'points', 'viewBox',
  'xmlns', 'preserveAspectRatio',
]);

function scanFile(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, 'utf8');
  const src = stripComments(raw);
  const lines = src.split('\n');
  const findings = [];

  // Pass 1: JSX text nodes — `>Foo Bar<` (start of a tag close or
  // open).
  const textRe = />\s*([^<>{][^<>{}]*?)\s*</g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    while ((m = textRe.exec(line)) !== null) {
      const s = m[1].trim();
      if (looksEnglish(s)) {
        findings.push({
          line: i + 1,
          kind: 'jsx-text',
          text: s,
          snippet: line.trim().slice(0, 140),
        });
      }
    }
  }

  // Pass 2: prop literals — `propName="…"` (string only).
  const propRe = /\b([A-Za-z][A-Za-z0-9]*)\s*=\s*"([^"\\]{1,200})"/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    while ((m = propRe.exec(line)) !== null) {
      const prop = m[1];
      const val = m[2];
      if (NON_COPY_PROPS.has(prop)) continue;
      if (prop.startsWith('data')) continue;
      if (prop.startsWith('on')) continue;
      if (prop === 'aria') continue;
      if (looksEnglish(val)) {
        // Skip if prop is one of those handled by tSafe — heuristic
        // check: is the line wrapped in tSafe nearby?
        if (/tSafe\s*\(|tStrict\s*\(|\bt\s*\(/.test(line)) continue;
        findings.push({
          line: i + 1,
          kind: 'prop:' + prop,
          text: val,
          snippet: line.trim().slice(0, 140),
        });
      }
    }
  }

  return { file: rel, findings };
}

const all = [];
for (const rel of TARGETS) {
  const r = scanFile(rel);
  if (!r) continue;
  if (r.findings.length === 0) continue;
  all.push(r);
}

// Sprint #190 — `npm run audit:i18n` enforcement mode. The build
// fails when findings EXCEED the ratcheted baseline (the 10 known
// findings documented in HARDCODED_STRINGS_AUDIT.md: 5 deferred
// true positives + 5 false positives the regex can't distinguish).
// New hardcoded strings push the count past the baseline and break
// the build; fixing deferred items lets the baseline ratchet down.
const enforce = process.argv.includes('--enforce');
// Sprint #196 — ratcheted 10 → 5. The 5 deferred true positives
// (SimpleHome ×2, SettingsDrawer ×1, Login ×2) were externalized;
// only the 5 known false positives remain (4 tSafe-fallback args
// in IntelligentScanResult + 1 logic fragment in ScanPage).
const BASELINE_ALLOWED = 5;

// Sprint #191 — per-locale key coverage + LANGUAGE_COVERAGE_REPORT.md.
// Structural coverage = (locale keys present / en keys). Enforcement
// threshold ≥ 98% per launch locale. Real-translation coverage is
// reported separately from the translator-review sidecar — it is
// NOT gated (Hindi is honestly at ~54% real translation with
// English fallback; gating it would force fake translations).
const COVERAGE_MIN_PCT = 98;
const LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];

function _countColumnKeys(code) {
  const src = (() => {
    try {
      return fs.readFileSync(
        path.join(ROOT, 'src', 'i18n', 'columns', 'T-' + code + '.js'), 'utf8');
    } catch { return ''; }
  })();
  const re = /^\s*"([^"\\]+)"\s*:\s*"/gm;
  let n = 0; let m;
  while ((m = re.exec(src)) !== null) n++;
  return n;
}

function _readSidecar() {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'i18n', 'columns', '_translator-review-pending.json'),
      'utf8'));
  } catch { return { perLocale: {} }; }
}

function _buildCoverage() {
  const enCount = _countColumnKeys('en');
  const sidecar = _readSidecar();
  const rows = [];
  for (const code of LOCALES) {
    const count = code === 'en' ? enCount : _countColumnKeys(code);
    const structuralPct = enCount > 0
      ? Math.round((Math.min(count, enCount) / enCount) * 1000) / 10 : 0;
    const pending = (sidecar.perLocale && sidecar.perLocale[code]
      && Array.isArray(sidecar.perLocale[code].translatorReviewPending))
      ? sidecar.perLocale[code].translatorReviewPending.length : 0;
    const realPct = count > 0
      ? Math.round(((count - pending) / count) * 1000) / 10 : 0;
    rows.push({
      code, keys: count, enKeys: enCount,
      structuralPct,
      pendingReview: pending,
      realTranslationPct: code === 'en' ? 100 : realPct,
    });
  }
  return rows;
}

function _writeCoverageReport(rows, totalFindings, findingsByFile) {
  const lines = [];
  lines.push('# LANGUAGE_COVERAGE_REPORT.md');
  lines.push('');
  lines.push('**Generated by `npm run audit:i18n`.**');
  lines.push('');
  lines.push('## Coverage by locale');
  lines.push('');
  lines.push('| Locale | Keys | Structural coverage | Pending review | Real-translation coverage |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const r of rows) {
    lines.push('| ' + r.code + ' | ' + r.keys + ' | ' + r.structuralPct
      + '% | ' + r.pendingReview + ' | ' + r.realTranslationPct + '% |');
  }
  lines.push('');
  lines.push('Structural coverage = keys present vs the English canonical column.');
  lines.push('Real-translation coverage subtracts translator-review stubs that');
  lines.push('still carry English values (queue: `_translator-review-pending.json`).');
  lines.push('');
  lines.push('## Hardcoded-string findings (' + totalFindings + ')');
  lines.push('');
  if (findingsByFile.length === 0) {
    lines.push('None.');
  } else {
    for (const r of findingsByFile) {
      lines.push('### ' + r.file + ' (' + r.findings.length + ')');
      for (const f of r.findings.slice(0, 25)) {
        lines.push('- L' + f.line + ' [' + f.kind + '] ' + JSON.stringify(f.text));
      }
      lines.push('');
    }
    lines.push('Baseline allowance: ' + BASELINE_ALLOWED
      + ' (deferred + known false positives — see HARDCODED_STRINGS_AUDIT.md).');
  }
  lines.push('');
  lines.push('## Enforcement');
  lines.push('');
  lines.push('- Structural coverage must be ≥ ' + COVERAGE_MIN_PCT + '% per locale (build fails otherwise).');
  lines.push('- Hardcoded findings must be ≤ ' + BASELINE_ALLOWED + ' (build fails otherwise).');
  lines.push('- Real-translation coverage is reported, not gated — English');
  lines.push('  fallback with translator-review flag is the honest contract.');
  fs.writeFileSync(path.join(ROOT, 'LANGUAGE_COVERAGE_REPORT.md'),
    lines.join('\n') + '\n', 'utf8');
}

if (asJson) {
  console.log(JSON.stringify({ files: all }, null, 2));
} else {
  let totalFiles = 0;
  let totalFindings = 0;
  for (const r of all) {
    if (r.findings.length === 0) continue;
    totalFiles++;
    totalFindings += r.findings.length;
    console.log('\n' + r.file + '  (' + r.findings.length + ')');
    for (const f of r.findings.slice(0, 50)) {
      console.log('  L' + f.line + ' [' + f.kind + ']  ' + JSON.stringify(f.text));
    }
    if (r.findings.length > 50) {
      console.log('  …+' + (r.findings.length - 50) + ' more (truncated)');
    }
  }
  console.log('\n[audit-hardcoded-strings] ' + totalFindings
    + ' potential findings across ' + totalFiles + ' file(s)');
  console.log('[audit-hardcoded-strings] heuristic scanner — review for false positives');
  // Sprint #191 — coverage computation + report (always written so
  // the report stays fresh on every audit run).
  const coverage = _buildCoverage();
  _writeCoverageReport(coverage, totalFindings, all);
  console.log('[audit:i18n] wrote LANGUAGE_COVERAGE_REPORT.md');
  for (const r of coverage) {
    console.log('  ' + r.code + ': structural ' + r.structuralPct
      + '% · real ' + r.realTranslationPct + '% ('
      + r.pendingReview + ' pending review)');
  }

  if (enforce) {
    let failed = false;
    if (totalFindings > BASELINE_ALLOWED) {
      console.error('[audit:i18n] FAIL — ' + totalFindings
        + ' findings exceed ratcheted baseline of ' + BASELINE_ALLOWED
        + '. A new hardcoded English string was introduced; route it '
        + 'through tSafe(key, fallback).');
      failed = true;
    }
    for (const r of coverage) {
      if (r.structuralPct < COVERAGE_MIN_PCT) {
        console.error('[audit:i18n] FAIL — locale ' + r.code
          + ' structural coverage ' + r.structuralPct + '% < '
          + COVERAGE_MIN_PCT + '%. Run `node scripts/fill-language-parity.mjs`.');
        failed = true;
      }
    }
    if (failed) process.exit(1);
    console.log('[audit:i18n] PASS — findings ≤ baseline ' + BASELINE_ALLOWED
      + '; all locales ≥ ' + COVERAGE_MIN_PCT + '% structural coverage.');
  }
}
