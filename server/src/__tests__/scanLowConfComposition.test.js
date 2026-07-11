import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// P0 — exactly ONE low-confidence surface. The premium ScanGuidanceCard is the
// sole card; the near-duplicate AddPlantConfirmationCard ("We're not sure what
// this is yet") is suppressed on the low-confidence terminal state at the
// container (ScanPage) level, not with CSS.
describe('P0 — single low-confidence result card', () => {
  const scanPage = read('src/pages/ScanPage.jsx');

  it('suppresses AddPlantConfirmationCard on low-confidence via the shared resolver', () => {
    const idx = scanPage.indexOf('<AddPlantConfirmationCard');
    expect(idx).toBeGreaterThan(-1);
    const before = scanPage.slice(Math.max(0, idx - 600), idx);
    // The suppression now uses the SINGLE resolver shared with the result card
    // (no divergent confidenceTone/<40 heuristic that could re-introduce a duplicate).
    expect(before).toContain('resolveScanGuidance(result).showGuidance');
  });

  it('keeps ScanGuidanceCard as the single low-confidence surface with its CTAs', () => {
    const guidance = read('src/components/scan/ScanGuidanceCard.jsx');
    expect(guidance).toContain('scan-guidance-card');
    expect(guidance).toContain('scan.guidance.title');
    // Button hierarchy: Scan Again / Choose from Gallery / Ask an Agronomist.
    expect(guidance).toContain('scan.guidance.scanAgain');
    expect(guidance).toContain('scan.guidance.chooseGallery');
    expect(guidance).toContain('scan.guidance.askAgronomist');
  });
});

// P1 — Crop Health must not render before a successful identification. On the
// low-confidence guidance path, CropHealthSection is gated off.
describe('P1 — Crop Health hidden until identification succeeds', () => {
  const code = read('src/components/scan/IntelligentScanResult.jsx');

  it('gates CropHealthSection behind !_showGuidance', () => {
    expect(code).toMatch(/!_showGuidance\s*\?\s*<CropHealthSection/);
  });
});
