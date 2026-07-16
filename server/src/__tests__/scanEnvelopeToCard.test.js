/**
 * scanEnvelopeToCard.test.js — reproduce the founder's device screenshot.
 *
 * Server logs prove /api/scan/analyze sent identificationState='PROVISIONAL'
 * (scan_mrnsyhhj top=0.55 margin=0.51), yet the phone rendered the lowId
 * dead-end (no candidate name, no Confirm). This test feeds the resolver the
 * SAME envelope the server sends — through the same client transformations —
 * to find where the state gets lost.
 */
import { describe, it, expect } from 'vitest';
import { resolveScanGuidance } from '../../../src/runtime/scanTrust/scanGuidanceResolver';

// A faithful replica of the production _scanResponse for scan_mrnsyhhj,
// AFTER the client engine/hybrid transforms (banded confidence string +
// legacy needs_review stamps that predate the server-owned decision).
const SERVER_ENVELOPE = {
  scanId: 'scan_mrnsyhhj',
  identificationState: 'PROVISIONAL',
  identificationReasonCode: 'provisional',
  plantProbability: 1.0,
  confidenceMargin: 0.51,
  secondConfidence: 0.04,
  requiresConfirmation: true,
  allowedActions: ['CONFIRM_PLANT', 'SELECT_ALTERNATE', 'RETRY_PROVIDER'],
  confirmationCandidates: [
    { taxonId: 'taxon:x', commonName: 'SomePlant', scientificName: 'Planta exempla', providerConfidence: 0.55 },
  ],
  topCandidates: [
    { commonName: 'SomePlant', scientificName: 'Planta exempla', score: 0.55 },
    { commonName: 'OtherPlant', scientificName: 'Planta altera', score: 0.04 },
  ],
  plantName: 'SomePlant',
  confidencePct: 55,
  // Legacy trust-gate stamps the client pipeline adds/preserves for sub-70:
  confidence: 'medium',            // hybrid band overwrite
  confidenceTone: 'needs_review',  // ScanPage _confidenceTone for non-high/medium... 'medium' → medium_confidence; keep worst case:
  status: 'needs_review',
};

describe('server PROVISIONAL envelope → client card state', () => {
  it('resolver consumes the server state (must be IDENTIFIED_PROVISIONAL, not lowId)', () => {
    const g = resolveScanGuidance(SERVER_ENVELOPE);
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(g.showProvisional).toBe(true);
    expect(g.provisional && g.provisional.plantName).toBe('SomePlant');
  });

  it('LOW_CONFIDENCE server state maps to the lowId family (with candidates now attached)', () => {
    const g = resolveScanGuidance({ ...SERVER_ENVELOPE, identificationState: 'LOW_CONFIDENCE' });
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE');
  });

  it('WITHOUT identificationState the legacy stamps downgrade to lowId (the dead-end)', () => {
    const { identificationState, ...noState } = SERVER_ENVELOPE;
    const g = resolveScanGuidance(noState);
    expect(g.state).toBe('LOW_IDENTIFICATION_CONFIDENCE'); // ← what the device showed
  });
});

// ── THE ROOT CAUSE: ScanRuntime's envelope builder ─────────────────────────
// The old inline build whitelisted 11 fields and discarded the entire
// intelligence envelope — so the device ALWAYS hit the dead-end above,
// no matter what the server resolved. buildResultEnvelope must preserve
// every raw field AND still satisfy the §12 contract.
import { buildResultEnvelope, validateScanResult } from '../../../src/core/scan/scanRuntimeContracts.js';

describe('buildResultEnvelope — the last-mile strip fix', () => {
  const CTX = { sessionId: 'sess-1', imageId: 'img-1', previewUrl: 'blob:x' };

  it('preserves the FULL intelligence envelope (the fields the whitelist dropped)', () => {
    const env = buildResultEnvelope(SERVER_ENVELOPE, CTX);
    expect(env.identificationState).toBe('PROVISIONAL');
    expect(env.requiresConfirmation).toBe(true);
    expect(env.confirmationCandidates).toHaveLength(1);
    expect(env.topCandidates).toHaveLength(2);
    expect(env.plantName).toBe('SomePlant');
    expect(env.confidencePct).toBe(55);
  });

  it('still satisfies the §12 contract and passes validateScanResult', () => {
    const env = buildResultEnvelope(SERVER_ENVELOPE, CTX);
    expect(env.sessionId).toBe('sess-1');
    expect(env.imageValidated).toBe(true);
    expect(env.classifierInputVerified).toBe(true);
    expect(typeof env.timestamp).toBe('number');
    expect(validateScanResult(env).valid).toBe(true);
  });

  it('END-TO-END: runtime envelope → resolver → PROVISIONAL card (the button renders)', () => {
    const g = resolveScanGuidance(buildResultEnvelope(SERVER_ENVELOPE, CTX));
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(g.showProvisional).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => buildResultEnvelope(null, null)).not.toThrow();
    expect(buildResultEnvelope(null, null)).toBeTypeOf('object');
  });
});
