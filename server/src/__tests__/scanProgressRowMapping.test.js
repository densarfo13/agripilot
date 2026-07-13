import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveScanGuidance } from '../../../src/runtime/scanTrust/scanGuidanceResolver';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// The production mismatch: header used the new state-aware copy but the progress
// rows still said "Waiting for a clearer photo". The rows must map ONLY from the
// canonical server state (spec §3).
describe('scan progress rows — canonical-state driven (spec §3)', () => {
  const intel = read('src/components/scan/IntelligentScanResult.jsx');
  const card = read('src/components/scan/ScanGuidanceCard.jsx');

  it('progress-row copy is keyed by the canonical state, not confidence/candidate count', () => {
    expect(intel).toContain('_PROGRESS_ROWS');
    expect(intel).toMatch(/_PROGRESS_ROWS\[\s*_guidance\.state\s*\]/);
  });

  it('LOW_IDENTIFICATION_CONFIDENCE rows never say "clearer photo"', () => {
    expect(intel).toContain('Several possibilities found');
    expect(intel).toContain('Waiting for plant confirmation');
    // the LOW row block must not carry the legacy phrase
    const lowRow = intel.slice(intel.indexOf('LOW_IDENTIFICATION_CONFIDENCE:'), intel.indexOf('IDENTIFIED_PROVISIONAL:'));
    expect(lowRow).not.toMatch(/clearer photo/i);
  });

  it('PROVISIONAL rows say "Possible plant found" / "Confirm the plant to continue"', () => {
    expect(intel).toContain('Possible plant found');
    expect(intel).toContain('Confirm the plant to continue');
  });

  it('the card renders the per-stage state-aware note (not the generic pending suffix)', () => {
    expect(card).toMatch(/s\.noteKey\s*\|\|\s*s\.noteDefault/);
    // the generic "clearer photo" suffix survives ONLY as a fallback AFTER the note branch
    const noteIdx = card.indexOf('s.noteKey || s.noteDefault');
    const pendingIdx = card.indexOf("'Waiting for a clearer photo'");
    expect(noteIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeGreaterThan(noteIdx); // note branch comes first
  });

  it('§6 — a requiresConfirmation contract with no candidates fails closed + logs the code', () => {
    expect(intel).toContain('_contractMismatch');
    expect(intel).toContain('SCAN_RESULT_CONTRACT_MISMATCH');
    expect(card).toContain('scan.contractMismatch');
  });
});

// The client must render from the SERVER-stamped identificationState and must not
// re-derive it from raw confidence or legacy flags (spec §2 / §8).
describe('client consumes server-stamped state (no re-derivation)', () => {
  const withCand = (extra) => ({ topCandidates: [{ commonName: 'Maize', scientificName: 'Zea mays' }], plantName: 'Maize', scanId: 's1', ...extra });

  it('server LOW_CONFIDENCE wins even when the raw confidence number is high', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'LOW_CONFIDENCE', confidencePct: 95 }));
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE');
    expect(g.showGuidance).toBe(true);
  });

  it('server PROVISIONAL wins even when raw confidence is low', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'PROVISIONAL', confidencePct: 10 }));
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(g.showProvisional).toBe(true);
  });

  it('a legacy clearerPhotoNeeded flag cannot override the server state', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'PROVISIONAL', confidencePct: 55, clearerPhotoNeeded: true }));
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
  });

  it('server CONFIRMED → no guidance card', () => {
    const g = resolveScanGuidance(withCand({ identificationState: 'CONFIRMED', confidencePct: 80 }));
    expect(g.state).toBe('IDENTIFIED_CONFIRMED');
    expect(g.showGuidance).toBe(false);
  });
});
