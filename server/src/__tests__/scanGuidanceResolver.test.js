import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveScanGuidance } from '../../../src/runtime/scanTrust/scanGuidanceResolver';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// P1 — the fixed defect: the trust gate blocks below 70, but the old ScanPage
// dedup only suppressed the legacy card below 40. A result in [40, 70) therefore
// rendered BOTH cards. The shared resolver must own that whole band.
describe('resolveScanGuidance — single low-confidence owner (P1)', () => {
  const withCand = (extra) => ({ topCandidates: [{ commonName: 'Maize' }], plantName: 'Maize', scanId: 's1', ...extra });

  it('confidence in [40,70) → showGuidance=true (the old <40 dedup missed this)', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 55 }));
    expect(g.showGuidance).toBe(true);
    expect(g.trustBlocked).toBe(true);
  });
  it('confidence just below the trust threshold (69) is still owned by guidance', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 69 })).showGuidance).toBe(true);
  });
  it('high confidence (85) → showGuidance=false (legacy confirm card allowed)', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 85 })).showGuidance).toBe(false);
  });
  it('a successful high-confidence candidate is NOT forced into guidance/unknown', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 92 }));
    expect(g.showGuidance).toBe(false);
    expect(g.trustBlocked).toBe(false);
  });
  it('no candidates → showGuidance=true', () => {
    expect(resolveScanGuidance({ confidencePct: 90, topCandidates: [], plantName: '', scanId: 's1' }).showGuidance).toBe(true);
  });
  it('explicit needs_review status → showGuidance=true even at high confidence', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 90, status: 'needs_review' })).showGuidance).toBe(true);
  });
  it('null / garbage input never throws and returns a boolean', () => {
    expect(() => resolveScanGuidance(null)).not.toThrow();
    expect(typeof resolveScanGuidance(null).showGuidance).toBe('boolean');
  });
});

// P1/P2/P3 — composition + progress-state wiring (source assertions).
describe('scan composition + progress-state wiring', () => {
  it('ScanPage suppresses the legacy card via the SHARED resolver, not a divergent threshold', () => {
    const code = read('src/pages/ScanPage.jsx');
    expect(code).toContain('resolveScanGuidance(result).showGuidance');
    expect(code).not.toMatch(/confidencePct\)\s*<\s*40/); // old divergent heuristic removed
  });
  it('IntelligentScanResult uses the same resolver for the guidance decision', () => {
    const code = read('src/components/scan/IntelligentScanResult.jsx');
    expect(code).toContain('resolveScanGuidance');
    expect(code).toContain('_guidance.showGuidance');
  });
  it('the "Identifying plant" stage is derived from real identification, not hard-coded done (P2)', () => {
    const code = read('src/components/scan/IntelligentScanResult.jsx');
    expect(code).toContain('_identifyState');
    expect(code).toMatch(/_hasIdentification\s*\?\s*'done'/);
    expect(code).not.toMatch(/'Identifying plant',\s*state:\s*'done'/);
  });
  it('ScanGuidanceCard renders a distinct failed stage state (P2)', () => {
    const code = read('src/components/scan/ScanGuidanceCard.jsx');
    expect(code).toContain("state === 'failed'");
    expect(code).toContain('scan.stage.failed');
  });
  it('exactly one Scan Again button and one expert-review action in the guidance card (P3)', () => {
    const code = read('src/components/scan/ScanGuidanceCard.jsx');
    expect((code.match(/data-testid="scan-guidance-retake"/g) || []).length).toBe(1);
    // single tertiary expert-review action ("Ask an Agronomist")
    expect((code.match(/data-testid="scan-guidance-save-review"/g) || []).length).toBe(1);
    expect(code).toContain("'Ask an Agronomist'");
  });
});
