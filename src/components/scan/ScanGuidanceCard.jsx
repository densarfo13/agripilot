/**
 * ScanGuidanceCard — THE single low-confidence guidance surface (UX sprint 2026-07-05).
 *
 * Replaces four overlapping low-confidence messages that could stack on one result:
 *   "Needs Review" (NeedsReviewActions) · "Needs Closer Inspection" · "Photo needs a
 *   clearer view" (trust-gate coach card) · "We couldn't read this photo clearly".
 * One card, one explanation, one set of CTAs — rendered directly beneath the scan
 * header so the farmer's next action is the first thing they see.
 *
 * Honesty: renders ONLY real signals passed in (photo-quality reasons come from
 * PhotoQualityEngine's measured sub-scores; the quality label is the engine's own).
 * Nothing here computes or invents a diagnosis.
 *
 * Accessibility: ≥48px touch targets, aria-labels, high-contrast text on light amber.
 * Strict-rule audit: pure render · never throws · inline styles · tSafe only.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isFn = (f) => typeof f === 'function';
const _arr = (v) => (Array.isArray(v) ? v : []);

const C = {
  bg: '#FFF7ED', border: '#FED7AA', ink: '#7C2D12', title: '#9A3412',
  action: '#1F6A3A', actionInk: '#FFFFFF', line: 'rgba(124,45,18,0.25)',
};

const S = {
  card: {
    background: C.bg, border: '1px solid ' + C.border, borderRadius: 16,
    padding: '14px 16px', marginBottom: 12,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 800, color: C.title, lineHeight: 1.35 },
  body: { margin: '8px 0 0', fontSize: 14, color: C.ink, lineHeight: 1.5 },
  small: { margin: '8px 0 0', fontSize: 13, color: C.ink, lineHeight: 1.5 },
  list: { margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.6 },
  tipsTitle: { margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: C.title },
  btnPrimary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 12,
    border: 'none', borderRadius: 999, background: C.action, color: C.actionInk,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnSecondary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 8,
    border: '1px solid ' + C.line, borderRadius: 999, background: 'transparent',
    color: C.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnTertiary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 4,
    border: 'none', borderRadius: 999, background: 'transparent',
    color: C.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'underline', textUnderlineOffset: 3,
  },
};

// PhotoQualityEngine qualityLabel → farmer word. Absent OR unmeasured/unknown labels
// render as "Not measured yet" — NEVER the raw internal label (no "unknown", no internal
// terms on the farmer screen, per the scan-language contract). A genuinely unrecognised
// label is treated as unmeasured rather than leaked verbatim.
function _qualityText(label) {
  const l = String(label || '').toLowerCase();
  const notMeasured = tSafe('scan.guidance.quality.notMeasured', 'Not measured yet');
  if (!l) return '';
  if (l === 'excellent' || l === 'high') return tSafe('scan.guidance.quality.excellent', 'Excellent');
  if (l === 'good') return tSafe('scan.guidance.quality.good', 'Good');
  if (l === 'fair' || l === 'medium' || l === 'ok') return tSafe('scan.guidance.quality.fair', 'Fair');
  if (l === 'poor' || l === 'low' || l === 'bad') return tSafe('scan.guidance.quality.poor', 'Poor');
  if (l === 'unknown' || l === 'unmeasured' || l === 'not_measured' || l === 'n/a') return notMeasured;
  return notMeasured; // any other internal label → honest "Not measured yet", never leaked raw
}

const TIPS = [
  ['scan.guidance.tip.daylight', 'Use daylight'],
  ['scan.guidance.tip.fillFrame', 'Fill the frame with the leaf'],
  ['scan.guidance.tip.oneLeaf', 'One leaf at a time'],
  ['scan.guidance.tip.avoidBlur', 'Hold steady to avoid blur'],
  ['scan.guidance.tip.noFingers', 'Keep fingers out of the photo'],
];

export default function ScanGuidanceCard({
  reasons,            // PhotoQualityEngine coaching keys / texts (the honest "why")
  qualityLabel,       // PhotoQualityEngine qualityLabel (measured; may be absent)
  showTreatmentLockedNote,
  onRetake,
  onUpload,
  onSaveForReview,
}) {
  const _reasons = _arr(reasons).slice(0, 4);
  const _quality = _qualityText(qualityLabel);
  return (
    <section style={S.card} data-testid="scan-guidance-card" role="region"
      aria-label={tSafe('scan.guidance.title', "We couldn't identify the plant clearly.")}>
      <h3 style={S.title} data-testid="scan-guidance-title">
        {tSafe('scan.guidance.title', "We couldn't identify the plant clearly.")}
      </h3>
      <p style={S.body}>
        {tSafe('scan.guidance.body',
          'Take one close photo of a single leaf in daylight. Avoid shadows and include only the affected area.')}
      </p>

      {_quality ? (
        <p style={S.small} data-testid="scan-guidance-quality">
          <strong>{tSafe('scan.guidance.quality.label', 'Photo quality')}:</strong> {_quality}
        </p>
      ) : null}
      {_reasons.length > 0 ? (
        <ul style={S.list} data-testid="scan-guidance-reasons">
          {_reasons.map((k, i) => <li key={'gr-' + i}>{tSafe(k, k)}</li>)}
        </ul>
      ) : null}

      <p style={S.tipsTitle}>{tSafe('scan.guidance.tipsTitle', 'Camera tips')}</p>
      <ul style={S.list} data-testid="scan-guidance-tips">
        {TIPS.map(([k, fb], i) => <li key={'gt-' + i}>{tSafe(k, fb)}</li>)}
      </ul>

      {showTreatmentLockedNote ? (
        <p style={S.small} data-testid="scan-guidance-treatment-note">
          {tSafe('scan.guidance.treatmentLocked',
            "Once we can clearly identify the plant, we'll provide treatment recommendations.")}
        </p>
      ) : null}

      <button type="button" style={S.btnPrimary}
        data-testid="scan-guidance-retake"
        aria-label={tSafe('scanQuality.retakePhoto', 'Retake Photo')}
        onClick={_isFn(onRetake) ? onRetake : undefined}
        disabled={!_isFn(onRetake)}>
        {tSafe('scanQuality.retakePhoto', 'Retake Photo')}
      </button>
      <button type="button" style={S.btnSecondary}
        data-testid="scan-guidance-upload"
        aria-label={tSafe('scanQuality.uploadAnother', 'Upload Another Photo')}
        onClick={_isFn(onUpload) ? onUpload : undefined}
        disabled={!_isFn(onUpload)}>
        {tSafe('scanQuality.uploadAnother', 'Upload Another Photo')}
      </button>
      <button type="button" style={S.btnTertiary}
        data-testid="scan-guidance-save-review"
        aria-label={tSafe('scanReview.saveForReview', 'Save for Review')}
        onClick={_isFn(onSaveForReview) ? onSaveForReview : undefined}
        disabled={!_isFn(onSaveForReview)}>
        {tSafe('scanReview.saveForReview', 'Save for Review')}
      </button>
    </section>
  );
}
