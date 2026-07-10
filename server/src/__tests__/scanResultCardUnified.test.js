/**
 * scanResultCardUnified.test.js — locks the Apple-Health-meets-Plantix
 * scan Result Card consolidation (2026-07): ONE unified low-confidence
 * card, no duplicated Command Center, Confidence % instead of
 * "Photo quality: Unknown", icon chips, Voice hidden on the guidance view.
 *
 * Source-inspection tests (components use hooks + JSX; mirrors
 * scanPreviewFix.test.js's approach).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('ScanGuidanceCard — unified Result Card', () => {
  const src = read('src/components/scan/ScanGuidanceCard.jsx');

  it('shows a ⚠️ "Clearer photo needed" status badge', () => {
    expect(src).toContain('scanQuality.photoNeedsClearerView');
    expect(src).toContain('scan-guidance-status');
    expect(src).toContain('⚠️');
  });

  it('renders Identification Confidence % from the real confidencePct prop, not a photo-quality label', () => {
    expect(src).toContain('confidencePct');
    expect(src).toContain("tSafe('scan.guidance.identConfidence'");
    // The old "Photo quality: Unknown" leak must be gone — the quality-label
    // i18n key and the qualityLabel prop are no longer used (mentions in the
    // file header comment describing the OLD behavior are fine).
    expect(src).not.toContain('scan.guidance.quality.label');
    expect(src).not.toContain('qualityLabel');
  });

  it('shows an HONEST processing checklist — stages + state, never a fabricated latency', () => {
    // The stage list renders done/skipped/pending state from real envelope
    // signals. No per-stage timing exists client-side, so none is shown.
    expect(src).toContain('scan-guidance-timeline');
    expect(src).toContain('scan.stage.pending');
    // The stage rows render a status glyph, never a millisecond latency.
    expect(src).toContain('_stageGlyph');
    expect(src).not.toMatch(/stageState[^}]*\d+\s*ms/);
  });

  it('renders camera tips as icon chips (not a bullet list)', () => {
    expect(src).toContain('scan-guidance-tips');
    expect(src).toContain('ff-scan-chip');
    for (const icon of ['☀️', '🍃', '📷', '✋']) expect(src).toContain(icon);
  });

  it('uses the 3-tier button hierarchy: Scan Again / Choose from Gallery / Ask an Agronomist', () => {
    expect(src).toContain("tSafe('scan.guidance.scanAgain'");      // primary
    expect(src).toContain("tSafe('scan.guidance.chooseGallery'");  // secondary
    expect(src).toContain("tSafe('scan.guidance.askAgronomist'");  // tertiary
    // The tertiary IS the save-for-review escalation — keeps the trust-gate
    // contract testid (sprint #214) even though the label is friendlier.
    expect(src).toContain('scan-guidance-save-review');
  });

  it('animates: fade-in + press states, gated by prefers-reduced-motion', () => {
    expect(src).toMatch(/ffScanResultIn\s+320ms/);
    expect(src).toContain('prefers-reduced-motion');
  });
});

describe('IntelligentScanResult — single card + voice gating', () => {
  const src = read('src/components/scan/IntelligentScanResult.jsx');

  it('passes the numeric confidencePct into the guidance card', () => {
    expect(src).toMatch(/confidencePct=\{_num\(result && result\.confidencePct\)\}/);
  });

  it('hides the Voice header on the low-confidence guidance view', () => {
    expect(src).toMatch(/!_showGuidance \? <VoiceHeader/);
  });
});

describe('ScanCommandCard — no duplicate Command Center on low confidence', () => {
  const src = read('src/components/scan/ScanCommandCard.jsx');

  it('returns null when confidence is low (guidance card is the single source of truth)', () => {
    expect(src).toContain('normalizeScanConfidence'); // gate-required, still present
    expect(src).toMatch(/if \(confidenceBand === 'low'\) return null;/);
  });
});

describe('i18n — messages unified in the EN column', () => {
  const en = read('src/i18n/columns/T-en.js');

  it('uses the single confident-identify message (old phrasing gone)', () => {
    expect(en).toContain("We couldn't confidently identify this crop.");
    expect(en).not.toContain("We couldn't identify the plant clearly.");
  });

  it('renames the actions to Gallery + Expert Review', () => {
    expect(en).toContain('"scanQuality.uploadAnother": "Upload from Gallery"');
    expect(en).toContain('"scanReview.saveForReview": "Save for Expert Review"');
    expect(en).toContain('"scanQuality.photoNeedsClearerView": "Clearer photo needed"');
  });
});
