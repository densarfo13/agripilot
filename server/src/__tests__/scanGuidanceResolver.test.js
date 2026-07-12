import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveScanGuidance } from '../../../src/runtime/scanTrust/scanGuidanceResolver';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// The evidence-backed state machine (spec §2 + §5): low image quality, low
// identification confidence, not-a-plant, provider error, provisional, and
// confirmed are DISTINCT — a valid image the provider couldn't confidently name
// must NEVER be labelled "clearer photo needed", and a plausible sub-threshold
// candidate must be shown as provisional (confirm), not thrown away.
describe('resolveScanGuidance — evidence-backed state machine', () => {
  const withCand = (extra) => ({ topCandidates: [{ commonName: 'Maize', scientificName: 'Zea mays' }], plantName: 'Maize', scanId: 's1', ...extra });

  it('≥70 with candidates → IDENTIFIED_CONFIRMED (no guidance, no provisional)', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 85 }));
    expect(g.state).toBe('IDENTIFIED_CONFIRMED');
    expect(g.showGuidance).toBe(false);
    expect(g.showProvisional).toBe(false);
    expect(g.trustBlocked).toBe(false);
  });

  it('[45,70) plausible candidate → IDENTIFIED_PROVISIONAL (confirm, not "clearer photo")', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 55 }));
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(g.showProvisional).toBe(true);
    expect(g.showGuidance).toBe(false);            // NOT the low-confidence guidance card
    expect(g.provisional.plantName).toBe('Maize');
    expect(g.provisional.confidencePct).toBe(55);
  });

  it('69 (just below trusted) is still provisional, not confirmed', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 69 })).state).toBe('IDENTIFIED_PROVISIONAL');
  });
  it('45 (provisional floor, inclusive) → provisional', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 45 })).state).toBe('IDENTIFIED_PROVISIONAL');
  });

  it('<45 with a valid image + candidates → LOW_IDENTIFICATION_CONFIDENCE (guidance, NOT image quality)', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 30 }));
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE');
    expect(g.showGuidance).toBe(true);
    expect(g.showProvisional).toBe(false);
  });

  it('accepts fractional confidence (0..1) and normalizes to pct', () => {
    expect(resolveScanGuidance(withCand({ confidence: 0.82 })).state).toBe('IDENTIFIED_CONFIRMED');
    expect(resolveScanGuidance(withCand({ confidence: 0.55 })).state).toBe('IDENTIFIED_PROVISIONAL');
  });

  it('no candidates → LOW_IDENTIFICATION_CONFIDENCE (never provisional)', () => {
    const g = resolveScanGuidance({ confidencePct: 90, topCandidates: [], plantName: '', scanId: 's1' });
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE');
    expect(g.showGuidance).toBe(true);
  });

  it('explicit needs_review → LOW_IDENTIFICATION_CONFIDENCE even at high confidence (human review, not provisional)', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 90, status: 'needs_review' }));
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE');
    expect(g.showGuidance).toBe(true);
    expect(g.showProvisional).toBe(false);
  });

  it('serviceUnavailable + no candidates → PROVIDER_ERROR (not "clearer photo")', () => {
    const g = resolveScanGuidance({ serviceUnavailable: true, topCandidates: [], plantName: '', scanId: 's1' });
    expect(g.state).toBe('PROVIDER_ERROR');
    expect(g.showGuidance).toBe(true);
  });

  it('explicit low isPlant probability → NOT_A_PLANT', () => {
    const g = resolveScanGuidance(withCand({ confidencePct: 80, isPlant: 0.1 }));
    expect(g.state).toBe('NOT_A_PLANT');
    expect(g.showGuidance).toBe(true);
  });

  it('null / garbage input never throws and returns a valid state', () => {
    expect(() => resolveScanGuidance(null)).not.toThrow();
    expect(typeof resolveScanGuidance(null).state).toBe('string');
    expect(typeof resolveScanGuidance(null).showGuidance).toBe('boolean');
  });
});

// Option-1 requirement #7 — the client CONSUMES the server-stamped
// identificationState and must NOT re-derive the band from confidencePct.
describe('resolveScanGuidance — consumes server identificationState (no client re-derivation)', () => {
  const withCand = (extra) => ({ topCandidates: [{ commonName: 'Maize' }], plantName: 'Maize', scanId: 's1', ...extra });

  it('server CONFIRMED wins even when confidencePct would read LOW client-side', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'CONFIRMED', confidencePct: 10 }));
    expect(g.state).toBe('IDENTIFIED_CONFIRMED');   // NOT LOW_IDENTIFICATION_CONFIDENCE
    expect(g.showGuidance).toBe(false);
  });

  it('server PROVISIONAL wins even when confidencePct would read CONFIRMED client-side', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'PROVISIONAL', confidencePct: 95 }));
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(g.showProvisional).toBe(true);
  });

  it('server LOW_CONFIDENCE / NOT_A_PLANT / PROVIDER_ERROR map to the guidance family', () => {
    expect(resolveScanGuidance(withCand({ identificationState: 'LOW_CONFIDENCE', confidencePct: 90 })).state)
      .toBe('LOW_IDENTIFICATION_CONFIDENCE');
    expect(resolveScanGuidance(withCand({ identificationState: 'NOT_A_PLANT', confidencePct: 90 })).state)
      .toBe('NOT_A_PLANT');
    expect(resolveScanGuidance(withCand({ identificationState: 'PROVIDER_ERROR', confidencePct: 90 })).state)
      .toBe('PROVIDER_ERROR');
  });

  it('absent identificationState → client falls back to its own computation (back-compat)', () => {
    expect(resolveScanGuidance(withCand({ confidencePct: 85 })).state).toBe('IDENTIFIED_CONFIRMED');
    expect(resolveScanGuidance(withCand({ confidencePct: 55 })).state).toBe('IDENTIFIED_PROVISIONAL');
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
