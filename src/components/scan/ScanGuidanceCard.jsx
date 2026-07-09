/**
 * ScanGuidanceCard — THE single low-confidence Result Card (Apple-Health-meets-Plantix
 * pass, 2026-07). One card, one status, one set of CTAs — the only surface a farmer sees
 * when the crop couldn't be confidently identified.
 *
 * Consolidation: this replaces the old stacked messages ("We couldn't read this photo
 * clearly" + "We couldn't identify the plant clearly" + a "Scan Command Center" header
 * + a "Photo quality: Unknown" line). The Command Center is suppressed on low confidence
 * (ScanCommandCard returns null), the Voice header is hidden on this view
 * (IntelligentScanResult), so this is the SOLE result card.
 *
 * Honesty: renders ONLY real signals passed in — the numeric `confidencePct` comes from
 * the scan envelope (0–100), the photo-quality "why" reasons come from PhotoQualityEngine's
 * measured sub-scores. Nothing here computes or invents a diagnosis or a number.
 *
 * Accessibility: ≥48px touch targets, aria-labels, high-contrast text on light amber.
 * Motion: 300ms fade-in, button spring + chip/card press — all gated by
 * prefers-reduced-motion. Strict-rule audit: pure render · never throws · tSafe only.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isFn = (f) => typeof f === 'function';
const _arr = (v) => (Array.isArray(v) ? v : []);
// Coerce a 0–100 confidence to a finite number, or null when absent (never invent 0%).
const _num = (v) => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
  return null;
};

const C = {
  bg: '#FFF7ED', border: '#FED7AA', ink: '#7C2D12', title: '#9A3412',
  action: '#1F6A3A', actionInk: '#FFFFFF', line: 'rgba(124,45,18,0.25)',
  badgeBg: '#FEF3C7', badgeInk: '#92400E', chipBg: '#FFFFFF',
};

// Scoped motion — keyframes + press/elevate can't live in inline styles. One static
// <style> block, reduced-motion aware, class-namespaced so it never leaks.
const CARD_CSS = `
@keyframes ffScanResultIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ff-scan-result{animation:ffScanResultIn 300ms ease-out both;transition:box-shadow 140ms ease}
.ff-scan-result:active{box-shadow:0 10px 28px rgba(124,45,18,0.16)}
.ff-scan-btn{transition:transform 120ms cubic-bezier(.2,.8,.3,1.25),box-shadow 120ms ease}
.ff-scan-btn:active{transform:scale(.97)}
.ff-scan-chip{transition:transform 120ms cubic-bezier(.2,.8,.3,1.25)}
.ff-scan-chip:active{transform:scale(.94)}
@media (prefers-reduced-motion: reduce){
  .ff-scan-result{animation:none}
  .ff-scan-btn,.ff-scan-chip{transition:none}
  .ff-scan-result:active,.ff-scan-btn:active,.ff-scan-chip:active{transform:none;box-shadow:none}
}
`;

const S = {
  card: {
    background: C.bg, border: '1px solid ' + C.border, borderRadius: 18,
    padding: '16px 16px 18px', marginBottom: 12,
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.badgeBg, color: C.badgeInk, borderRadius: 999,
    padding: '5px 12px', fontSize: 13, fontWeight: 700,
  },
  title: { margin: '12px 0 0', fontSize: 18, fontWeight: 800, color: C.title, lineHeight: 1.3 },
  body: { margin: '6px 0 0', fontSize: 14, color: C.ink, lineHeight: 1.5 },
  confBlock: {
    margin: '14px 0 0', padding: '12px 14px', background: C.chipBg,
    border: '1px solid ' + C.border, borderRadius: 14, textAlign: 'center',
  },
  confLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.badgeInk },
  confValue: { fontSize: 34, fontWeight: 800, color: C.title, lineHeight: 1.1, margin: '2px 0' },
  confHint: { fontSize: 13, color: C.ink },
  list: { margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.6 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 0' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.chipBg, border: '1px solid ' + C.border, borderRadius: 999,
    padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
  },
  chipIcon: { fontSize: 15, lineHeight: 1 },
  small: { margin: '12px 0 0', fontSize: 13, color: C.ink, lineHeight: 1.5 },
  btnPrimary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 16,
    border: 'none', borderRadius: 999, background: C.action, color: C.actionInk,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  secondaryRow: { display: 'flex', gap: 8, marginTop: 8 },
  btnSecondary: {
    flex: 1, minHeight: 48,
    border: '1px solid ' + C.line, borderRadius: 999, background: 'transparent',
    color: C.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};

// Camera tips as icon chips (replaces the old bullet list). Keys already registered.
const CHIPS = [
  ['☀️', 'scan.guidance.tip.daylight', 'Daylight'],
  ['🍃', 'scan.guidance.tip.oneLeaf', 'One Leaf'],
  ['📷', 'scan.guidance.tip.fillFrame', 'Fill Frame'],
  ['✋', 'scan.guidance.tip.avoidBlur', 'Hold Steady'],
];

export default function ScanGuidanceCard({
  reasons,            // PhotoQualityEngine coaching keys / texts (the honest "why")
  confidencePct,      // numeric 0–100 from the scan envelope (may be absent)
  showTreatmentLockedNote,
  onRetake,
  onUpload,
  onSaveForReview,
}) {
  const _reasons = _arr(reasons).slice(0, 3);
  const _pct = _num(confidencePct);
  const _pctShown = _pct === null ? null : Math.max(0, Math.min(100, Math.round(_pct)));
  return (
    <section className="ff-scan-result" style={S.card} data-testid="scan-guidance-card" role="region"
      aria-label={tSafe('scan.guidance.title', "We couldn't confidently identify this crop.")}>
      <style>{CARD_CSS}</style>

      <div style={S.badge} data-testid="scan-guidance-status">
        <span aria-hidden="true">⚠️</span>
        <span>{tSafe('scanQuality.photoNeedsClearerView', 'Clearer photo needed')}</span>
      </div>

      <h3 style={S.title} data-testid="scan-guidance-title">
        {tSafe('scan.guidance.title', "We couldn't confidently identify this crop.")}
      </h3>
      <p style={S.body}>
        {tSafe('scan.guidance.body', 'Take one close photo of a single leaf in daylight.')}
      </p>

      {/* Confidence — the real number, replacing the old "Photo quality: Unknown". Only
          rendered when the envelope actually carried a confidence value. */}
      {_pctShown !== null ? (
        <div style={S.confBlock} data-testid="scan-guidance-confidence">
          <div style={S.confLabel}>{tSafe('scan.confidence.label', 'Confidence')}</div>
          <div style={S.confValue}>{_pctShown}%</div>
          <div style={S.confHint}>{tSafe('scan.confidence.low', 'Low confidence')}</div>
        </div>
      ) : null}

      {_reasons.length > 0 ? (
        <ul style={S.list} data-testid="scan-guidance-reasons">
          {_reasons.map((k, i) => <li key={'gr-' + i}>{tSafe(k, k)}</li>)}
        </ul>
      ) : null}

      <div style={S.chips} data-testid="scan-guidance-tips">
        {CHIPS.map(([icon, k, fb], i) => (
          <span key={'chip-' + i} className="ff-scan-chip" style={S.chip}>
            <span aria-hidden="true" style={S.chipIcon}>{icon}</span>
            <span>{tSafe(k, fb)}</span>
          </span>
        ))}
      </div>

      {showTreatmentLockedNote ? (
        <p style={S.small} data-testid="scan-guidance-treatment-note">
          {tSafe('scan.guidance.treatmentLocked',
            "Once we can clearly identify the plant, we'll provide treatment recommendations.")}
        </p>
      ) : null}

      <button type="button" className="ff-scan-btn" style={S.btnPrimary}
        data-testid="scan-guidance-retake"
        aria-label={tSafe('scanQuality.retakePhoto', 'Retake Photo')}
        onClick={_isFn(onRetake) ? onRetake : undefined}
        disabled={!_isFn(onRetake)}>
        {tSafe('scanQuality.retakePhoto', 'Retake Photo')}
      </button>

      <div style={S.secondaryRow}>
        <button type="button" className="ff-scan-btn" style={S.btnSecondary}
          data-testid="scan-guidance-upload"
          aria-label={tSafe('scanQuality.uploadAnother', 'Upload from Gallery')}
          onClick={_isFn(onUpload) ? onUpload : undefined}
          disabled={!_isFn(onUpload)}>
          {tSafe('scanQuality.uploadAnother', 'Upload from Gallery')}
        </button>
        <button type="button" className="ff-scan-btn" style={S.btnSecondary}
          data-testid="scan-guidance-save-review"
          aria-label={tSafe('scanReview.saveForReview', 'Save for Expert Review')}
          onClick={_isFn(onSaveForReview) ? onSaveForReview : undefined}
          disabled={!_isFn(onSaveForReview)}>
          {tSafe('scanReview.saveForReview', 'Save for Expert Review')}
        </button>
      </div>
    </section>
  );
}
