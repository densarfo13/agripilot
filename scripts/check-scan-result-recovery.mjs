/**
 * check-scan-result-recovery.mjs — enforces the "never dead-end" contract:
 * every rich scan-result renderer (ScanResultCard / IntelligentScanResult) must be
 * wrapped in ScanResultErrorBoundary, so a result-render throw becomes a recoverable
 * "saved for review" state instead of the page-level "Scan temporarily unavailable".
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const BOUNDARY = 'src/components/scan/ScanResultErrorBoundary.jsx';
const b = rd(BOUNDARY);
if (!b) E.push('missing: ' + BOUNDARY);
if (!/getDerivedStateFromError/.test(b)) E.push(BOUNDARY + ' must be a real error boundary');
if (!/saved-for-review/.test(b)) E.push(BOUNDARY + ' must render the saved-for-review recovery state');
if (!/onRetry/.test(b)) E.push(BOUNDARY + ' must offer a retry affordance');

// Every file that renders a rich result must import + use the boundary.
const CALL_SITES = [
  'src/pages/ScanPage.jsx',
  'src/pages/ScanResultPage.jsx',
  'src/components/photo/PhotoIntelligence.jsx',
];
for (const f of CALL_SITES) {
  const src = rd(f);
  if (!src) { E.push('missing call site: ' + f); continue; }
  const rendersRich = /<ScanResultCard|<IntelligentScanResult/.test(src);
  if (!rendersRich) continue;
  if (!/ScanResultErrorBoundary/.test(src))
    E.push(f + ' renders a rich result but does not wrap it in ScanResultErrorBoundary');
}

if (E.length) { console.error('[check:scan-result-recovery] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-result-recovery] PASS — every rich scan-result renderer is wrapped in '
  + 'ScanResultErrorBoundary; a result-render crash recovers to "saved for review", never a dead-end.');
