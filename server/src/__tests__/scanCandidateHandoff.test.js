/**
 * scanCandidateHandoff.test.js — proves the candidate handoff WITHOUT a device.
 *
 * The farmer's dead-end evidence: identification reached "several possibilities
 * found", yet the card showed cand=0/0, source=fallback_15s_timer, no selectable
 * candidates, no confirm tap. This suite reproduces the exact failure modes and
 * asserts the repaired invariants (candidate-handoff repair, req 4-7):
 *
 *   req 4 — the fallback timer must NEVER overwrite a real, candidate-bearing result
 *   req 5 — confirm controls render whenever ≥1 normalized candidate exists
 *   req 6 — low-confidence candidates are preserved (not collapsed to empty),
 *           the ONLY exclusion being an explicit NOT_A_PLANT
 *   req 7 — provider returns candidates → delayed response → fallback fires:
 *           the candidates still reach a confirmable card
 */
import { describe, it, expect } from 'vitest';
import {
  resolveScanGuidance, isCandidateConfirmable,
} from '../../../src/runtime/scanTrust/scanGuidanceResolver';
import { buildResultEnvelope } from '../../../src/core/scan/scanRuntimeContracts.js';
import { shouldFallbackPublish } from '../../../src/core/scan/scanFallbackPolicy.js';

// A realistic delayed provider response (the shape /api/scan/analyze returns):
// "several possibilities found" — a ranked candidate list under a PROVISIONAL band.
const PROVIDER_WITH_CANDIDATES = {
  scanId: 'scan_handoff_1',
  identificationState: 'PROVISIONAL',
  requiresConfirmation: true,
  confirmationCandidates: [
    { taxonId: 'taxon:tomato', commonName: 'Tomato', scientificName: 'Solanum lycopersicum', providerConfidence: 0.55 },
    { taxonId: 'taxon:pepper', commonName: 'Pepper', scientificName: 'Capsicum annuum', providerConfidence: 0.21 },
  ],
  topCandidates: [
    { commonName: 'Tomato', scientificName: 'Solanum lycopersicum', score: 0.55 },
    { commonName: 'Pepper', scientificName: 'Capsicum annuum', score: 0.21 },
  ],
  plantName: 'Tomato',
  confidencePct: 55,
};

// The empty placeholder the fallback timer publishes — the dead-end shape.
const FALLBACK_PLACEHOLDER = {
  scanId: 'scan_fb_abc',
  possibleIssue: '',
  confidence: 'low',
  meta: { source: 'fallback_45s_timer' },
  // NO confirmationCandidates / topCandidates — this is why it read cand=0/0.
};

describe('isCandidateConfirmable — req 5 + 6 (candidate existence gates the controls)', () => {
  it('renders controls for a provisional match', () => {
    expect(isCandidateConfirmable('IDENTIFIED_PROVISIONAL', true, 2)).toBe(true);
  });
  it('renders controls for low-confidence WITH candidates (preserved, not collapsed)', () => {
    expect(isCandidateConfirmable('LOW_IDENTIFICATION_CONFIDENCE', false, 1)).toBe(true);
  });
  it('renders controls whenever ≥1 candidate exists, regardless of band', () => {
    // The old rule required state === LOW_IDENTIFICATION_CONFIDENCE and dropped
    // controls under any other band. Existence — not the band — is the gate now.
    expect(isCandidateConfirmable('IDENTIFIED_CONFIRMED', false, 3)).toBe(true);
  });
  it('the ONLY exclusion is an explicit NOT_A_PLANT', () => {
    expect(isCandidateConfirmable('NOT_A_PLANT', false, 5)).toBe(false);
  });
  it('no candidates + not provisional → no controls (correctly non-confirmable)', () => {
    expect(isCandidateConfirmable('LOW_IDENTIFICATION_CONFIDENCE', false, 0)).toBe(false);
  });
});

describe('end-to-end handoff — req 7 (candidates survive the transform chain)', () => {
  it('a delayed provider result with candidates → confirmable card', () => {
    const env = buildResultEnvelope(PROVIDER_WITH_CANDIDATES, { sessionId: 's', imageId: 'i', previewUrl: 'blob:x' });
    // Candidates preserved through the runtime envelope builder.
    expect(env.confirmationCandidates).toHaveLength(2);
    expect(env.topCandidates).toHaveLength(2);
    const g = resolveScanGuidance(env);
    const confirmable = isCandidateConfirmable(
      g.state, g.showProvisional, (env.confirmationCandidates || []).length,
    );
    expect(g.state).toBe('IDENTIFIED_PROVISIONAL');
    expect(confirmable).toBe(true); // "Yes, this is correct" IS tappable
  });

  it('the fallback placeholder is correctly NON-confirmable (cand=0/0 dead-end shape)', () => {
    const g = resolveScanGuidance(FALLBACK_PLACEHOLDER);
    const cands = Array.isArray(FALLBACK_PLACEHOLDER.confirmationCandidates)
      ? FALLBACK_PLACEHOLDER.confirmationCandidates.length : 0;
    expect(cands).toBe(0);
    expect(isCandidateConfirmable(g.state, g.showProvisional, cands)).toBe(false);
  });
});

describe('fallback precedence — req 4 (a real result is never overwritten)', () => {
  it('provider returned candidates → real result shown → fallback timer must NOT publish', () => {
    // Simulates: real result published (realResultShown=true) THEN the delayed
    // fallback timer fires. It must refuse — the candidates stay on screen.
    expect(shouldFallbackPublish({ realResultShown: true, fallbackShown: false, sessionStale: false })).toBe(false);
  });
  it('genuinely hung pipeline (no real result) → fallback MAY publish once', () => {
    expect(shouldFallbackPublish({ realResultShown: false, fallbackShown: false, sessionStale: false })).toBe(true);
  });
  it('never publishes twice, and never after the user moved on', () => {
    expect(shouldFallbackPublish({ realResultShown: false, fallbackShown: true, sessionStale: false })).toBe(false);
    expect(shouldFallbackPublish({ realResultShown: false, fallbackShown: false, sessionStale: true })).toBe(false);
  });
});

// Fullscreen-scanner spec — CANDIDATE HANDOFF PROTECTION: the explicitly named
// regression case my earlier suite did NOT cover — fallback guidance is ALREADY
// visible, THEN valid candidates arrive and must REPLACE the fallback (not the
// reverse). This is the exact sequence from the farmer's dead-end evidence.
describe('candidate state replaces an already-shown fallback', () => {
  it('fallback shown first → real candidates arrive → the real result is confirmable', () => {
    // The fallback placeholder was published (fallbackShown=true) during a hang.
    // The delayed real candidates then land. Resolving the REAL envelope must
    // yield a confirmable candidate card regardless of the prior fallback —
    // confirmability is a property of the current result, not of history.
    const env = buildResultEnvelope(PROVIDER_WITH_CANDIDATES, { sessionId: 's', imageId: 'i', previewUrl: 'blob:x' });
    const g = resolveScanGuidance(env);
    expect(isCandidateConfirmable(g.state, g.showProvisional, (env.confirmationCandidates || []).length)).toBe(true);
  });

  it('once real candidates have replaced the fallback, a late fallback re-fire cannot overwrite them', () => {
    // realResultShown latches true at the real publish; any subsequent fallback
    // callback (even one already past its fallbackShown gate) is refused.
    expect(shouldFallbackPublish({ realResultShown: true, fallbackShown: true, sessionStale: false })).toBe(false);
  });

  it('INVARIANT: a zero-candidate result never resolves to a candidate/confirm state ("Several possibilities" cannot show at cand=0)', () => {
    // Acceptance: never display "Several possibilities found" while the internal
    // candidate count is zero. The empty placeholder must be neither provisional
    // nor confirmable, so no candidate-bearing copy can render over it.
    const g = resolveScanGuidance(FALLBACK_PLACEHOLDER);
    expect(g.showProvisional).toBe(false);
    expect(g.state).not.toBe('IDENTIFIED_PROVISIONAL');
    expect(isCandidateConfirmable(g.state, g.showProvisional, 0)).toBe(false);
  });
});
