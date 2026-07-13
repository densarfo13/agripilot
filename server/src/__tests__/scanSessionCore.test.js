import { describe, it, expect } from 'vitest';
import { resolveNextView, getSessionLimits } from '../ml/scanSession/nextViewResolver.js';
import { aggregateEvidence } from '../ml/scanSession/evidenceAggregator.js';

// P2 — the guided next-view engine requests the MOST USEFUL view, never a generic
// "scan again", and stops / escalates when more photos won't help.
describe('resolveNextView — guided multi-view (P2)', () => {
  it('#1 one strong, health-resolved image → done (no extra photos)', () => {
    const r = resolveNextView({ identificationState: 'CONFIRMED', healthState: 'HEALTHY', photosSubmitted: 1, submittedViews: ['WHOLE_PLANT'] });
    expect(r.requiresMoreEvidence).toBe(false);
    expect(r.reasonCode).toBe('SUFFICIENT');
  });

  it('#2 weak whole-plant image → requests a leaf close-up', () => {
    const r = resolveNextView({ identificationState: 'LOW_CONFIDENCE', submittedViews: ['WHOLE_PLANT'], photosSubmitted: 1 });
    expect(r.requiresMoreEvidence).toBe(true);
    expect(r.requestedView).toBe('LEAF_FRONT');
    expect(r.reasonCode).toBe('NEED_CLOSEUP');
  });

  it('#3 disease/pest ambiguity → requests the leaf underside', () => {
    const r = resolveNextView({ identificationState: 'CONFIRMED', healthState: 'ISSUE_POSSIBLE', healthDisagreement: true, submittedViews: ['LEAF_FRONT'], photosSubmitted: 1 });
    expect(r.requestedView).toBe('LEAF_UNDERSIDE');
    expect(r.reasonCode).toBe('DISTINGUISH_PEST_FROM_DISEASE');
  });

  it('a FAILED image re-requests the SAME view (only re-request case)', () => {
    const r = resolveNextView({ identificationState: 'LOW_CONFIDENCE', imageQualityStatus: 'FAIL', latestView: 'LEAF_FRONT', submittedViews: [], photosSubmitted: 1 });
    expect(r.requestedView).toBe('LEAF_FRONT');
    expect(r.reasonCode).toBe('RETAKE_QUALITY');
  });

  it('#8 max photos reached → stops + escalates (never infinite)', () => {
    const r = resolveNextView({ identificationState: 'LOW_CONFIDENCE', photosSubmitted: 3, submittedViews: ['WHOLE_PLANT', 'LEAF_FRONT', 'LEAF_UNDERSIDE'] });
    expect(r.requiresMoreEvidence).toBe(false);
    expect(r.reasonCode).toBe('MAX_PHOTOS_REACHED');
    expect(r.maximumAdditionalPhotosRemaining).toBe(0);
  });

  it('never requests a view already submitted → escalates instead', () => {
    const r = resolveNextView({ identificationState: 'LOW_CONFIDENCE', submittedViews: ['WHOLE_PLANT', 'LEAF_FRONT'], photosSubmitted: 2 });
    expect(r.requiresMoreEvidence).toBe(false);
    expect(r.reasonCode).toBe('ESCALATE_LOW_CONFIDENCE');
  });

  it('#6 conflicting identity → asks for whole-plant context, then escalates', () => {
    expect(resolveNextView({ identificationState: 'CONFLICTING_EVIDENCE', submittedViews: ['LEAF_FRONT'], photosSubmitted: 1 }).requestedView).toBe('WHOLE_PLANT');
    expect(resolveNextView({ identificationState: 'CONFLICTING_EVIDENCE', submittedViews: ['WHOLE_PLANT'], photosSubmitted: 1 }).reasonCode).toBe('ESCALATE_CONFLICT');
  });

  it('NOT_A_PLANT → terminal, no view requested', () => {
    expect(resolveNextView({ identificationState: 'NOT_A_PLANT', photosSubmitted: 1 }).requiresMoreEvidence).toBe(false);
  });
});

// P9 — cost-control env knobs with safe, validated defaults.
describe('getSessionLimits (P9)', () => {
  it('safe defaults', () => {
    const l = getSessionLimits();
    expect(l.maxImages).toBe(3);
    expect(l.expiryMinutes).toBe(30);
    expect(l.maxIdentificationCalls).toBe(3);
    expect(l.maxHealthCalls).toBe(2);
  });
});

// P3/P4 — cross-view aggregation + identification rules.
describe('aggregateEvidence — cross-view rules (P3/P4)', () => {
  const img = (view, name, sci, score) => ({ viewType: view, imageQualityStatus: 'PASS', candidates: [{ commonName: name, scientificName: sci, providerConfidence: score }] });

  it('#1 one strong image → CONFIRMED (raw provider confidence preserved, not a combined score)', () => {
    const a = aggregateEvidence({ perImageResults: [img('WHOLE_PLANT', 'Tomato', 'Solanum lycopersicum', 0.85)] });
    expect(a.identificationState).toBe('CONFIRMED');
    expect(a.providerRawConfidence).toBe(0.85);
    expect(a.farrowayContextScore).toBe(0);
  });

  it('#5 same candidate across two views → CONFIRMED via cross-view agreement', () => {
    const a = aggregateEvidence({ perImageResults: [
      img('WHOLE_PLANT', 'Tomato', 'Solanum lycopersicum', 0.55),
      img('LEAF_FRONT', 'Tomato', 'Solanum lycopersicum', 0.52),
    ] });
    expect(a.identificationState).toBe('CONFIRMED');
    expect(a.reasonCode).toBe('cross_view_agreement');
    expect(a.crossViewAgreement).toBe(2);
  });

  it('#6 two images strongly disagree → CONFLICTING_EVIDENCE', () => {
    const a = aggregateEvidence({ perImageResults: [
      img('WHOLE_PLANT', 'Tomato', 'Solanum lycopersicum', 0.85),
      img('LEAF_FRONT', 'Maize', 'Zea mays', 0.82),
    ] });
    expect(a.identificationState).toBe('CONFLICTING_EVIDENCE');
  });

  it('#14 a prior confirmed crop is NOT overwritten by a weaker later photo', () => {
    const a = aggregateEvidence({
      priorConfirmed: { taxonId: 'taxon:solanum_lycopersicum', commonName: 'Tomato', scientificName: 'Solanum lycopersicum' },
      perImageResults: [img('LEAF_FRONT', 'Maize', 'Zea mays', 0.30)],
    });
    expect(a.identificationState).toBe('CONFIRMED');
    expect(a.topCandidate.commonName).toBe('Tomato');
    expect(a.reasonCode).toBe('PRIOR_CONFIRMED_KEPT');
  });

  it('a failed-quality image is excluded from aggregation', () => {
    const a = aggregateEvidence({ perImageResults: [
      img('WHOLE_PLANT', 'Tomato', 'Solanum lycopersicum', 0.85),
      { viewType: 'LEAF_FRONT', imageQualityStatus: 'FAIL', candidates: [{ commonName: 'Maize', scientificName: 'Zea mays', providerConfidence: 0.9 }] },
    ] });
    expect(a.identificationState).toBe('CONFIRMED');
    expect(a.topCandidate.commonName).toBe('Tomato');
  });

  it('weak evidence → LOW_CONFIDENCE; mid evidence → PROVISIONAL', () => {
    expect(aggregateEvidence({ perImageResults: [img('LEAF_FRONT', 'Tomato', 'Solanum lycopersicum', 0.30)] }).identificationState).toBe('LOW_CONFIDENCE');
    expect(aggregateEvidence({ perImageResults: [img('LEAF_FRONT', 'Tomato', 'Solanum lycopersicum', 0.55)] }).identificationState).toBe('PROVISIONAL');
  });
});
