/**
 * ScanGuidanceCard — THE single low-confidence Result Card (Apple-HIG pass, 2026-07).
 * One card, one status, one set of CTAs — the only surface a farmer sees when the crop
 * couldn't be confidently identified.
 *
 * Consolidation: this replaces the old stacked messages ("We couldn't read this photo
 * clearly" + "We couldn't identify the plant clearly" + a "Scan Command Center" header
 * + a "Photo quality: Unknown" line). The Command Center is suppressed on low confidence
 * (ScanCommandCard returns null), the Voice header is hidden on this view, Crop Health is
 * gated off, and the duplicate AddPlantConfirmationCard is suppressed — so this is the
 * SOLE low-confidence surface.
 *
 * Honesty (hard rules — every one enforced by the no-fabrication doctrine):
 *   • `confidencePct` is the REAL numeric from the scan envelope (0–100); never invented.
 *   • The processing checklist shows STAGES and their done/skipped/pending STATE only —
 *     it NEVER shows a latency, because no per-stage timing reaches the client. States are
 *     derived from real envelope signals by the caller.
 *   • There is deliberately NO "Lighting / Focus / Leaf Coverage / Blur / Shadows"
 *     sub-score panel: those five values are null in the result (the pipeline never
 *     populates them), so rendering them would be fabricated. The honest photo help is
 *     the measured `reasons` list + the static camera tips below.
 *   • No farmer-facing "AI" wording (the identify stage says "Identifying").
 *
 * Accessibility: ≥48px touch targets, aria-labels, high-contrast text on light amber.
 * Motion: 300ms fade-in, staged checklist reveal, button spring + chip press — all gated
 * by prefers-reduced-motion. Strict-rule audit: pure render · never throws · tSafe only.
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
  done: '#1F6A3A', doneBg: '#DCFCE7', pending: '#B45309', muted: '#A8A29E',
  failed: '#B91C1C',
};

// Scoped motion — keyframes + press/elevate can't live in inline styles. One static
// <style> block, reduced-motion aware, class-namespaced so it never leaks.
const CARD_CSS = `
@keyframes ffScanResultIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ffScanStageIn{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:none}}
.ff-scan-result{animation:ffScanResultIn 320ms cubic-bezier(.2,.7,.3,1) both;transition:box-shadow 140ms ease}
.ff-scan-stage{animation:ffScanStageIn 300ms ease-out both}
.ff-scan-btn{transition:transform 120ms cubic-bezier(.2,.8,.3,1.25),box-shadow 120ms ease,background 140ms ease}
.ff-scan-btn:active{transform:scale(.97)}
.ff-scan-chip{transition:transform 120ms cubic-bezier(.2,.8,.3,1.25)}
.ff-scan-chip:active{transform:scale(.94)}
@media (prefers-reduced-motion: reduce){
  .ff-scan-result,.ff-scan-stage{animation:none}
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
  confTrack: {
    height: 6, borderRadius: 999, background: 'rgba(124,45,18,0.12)',
    overflow: 'hidden', margin: '8px 2px 0',
  },
  confFill: (pct) => ({
    height: '100%', width: Math.max(4, Math.min(100, pct)) + '%',
    borderRadius: 999, background: C.title,
    transition: 'width 420ms cubic-bezier(.2,.7,.3,1)',
  }),
  confHint: { fontSize: 13, color: C.ink, marginTop: 6 },
  list: { margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.6 },
  // Processing checklist
  timeline: {
    margin: '14px 0 0', padding: '12px 14px', background: C.chipBg,
    border: '1px solid ' + C.border, borderRadius: 14,
  },
  timelineHead: {
    fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
    textTransform: 'uppercase', color: C.badgeInk, margin: '0 0 8px',
  },
  stageRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' },
  stageDot: (state) => ({
    flex: '0 0 auto', width: 22, height: 22, borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 800,
    background: state === 'done' ? C.doneBg : 'transparent',
    color: state === 'done' ? C.done
      : state === 'failed' ? C.failed
      : state === 'pending' ? C.pending : C.muted,
    border: state === 'done' ? 'none' : '1.5px solid '
      + (state === 'failed' ? 'rgba(185,28,28,0.45)'
        : state === 'pending' ? 'rgba(180,83,9,0.4)' : 'rgba(120,113,108,0.35)'),
  }),
  stageLabel: (state) => ({
    fontSize: 14, fontWeight: state === 'done' ? 600 : 500,
    color: state === 'skipped' ? C.muted : C.ink,
  }),
  stageState: { marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: C.pending },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 0' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.chipBg, border: '1px solid ' + C.border, borderRadius: 999,
    padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
  },
  chipIcon: { fontSize: 15, lineHeight: 1 },
  small: { margin: '12px 0 0', fontSize: 13, color: C.ink, lineHeight: 1.5 },
  actions: { marginTop: 16 },
  btnPrimary: {
    display: 'block', width: '100%', minHeight: 50,
    border: 'none', borderRadius: 999, background: C.action, color: C.actionInk,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(31,106,58,0.35)',
  },
  btnSecondary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 8,
    border: '1px solid ' + C.line, borderRadius: 999, background: 'transparent',
    color: C.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnTertiary: {
    display: 'block', width: '100%', minHeight: 44, marginTop: 8,
    border: 'none', borderRadius: 999, background: 'transparent',
    color: C.title, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'underline', textUnderlineOffset: 3,
  },
};

// Camera tips as icon chips (replaces the old bullet list). Keys already registered.
const CHIPS = [
  ['☀️', 'scan.guidance.tip.daylight', 'Daylight'],
  ['🍃', 'scan.guidance.tip.oneLeaf', 'One Leaf'],
  ['📷', 'scan.guidance.tip.fillFrame', 'Fill Frame'],
  ['✋', 'scan.guidance.tip.avoidBlur', 'Hold Steady'],
];

// Icon per stage state — honest glyphs, never a spinner.
function _stageGlyph(state) {
  if (state === 'done') return '✓';
  if (state === 'failed') return '✕';
  if (state === 'skipped') return '–';
  return '○';                         // pending
}

// Variant → header copy. The message MUST match the real backend state so
// "Clearer photo needed" is shown ONLY for a measured image problem — never
// for a valid image the provider simply couldn't confidently name. Each entry
// is [i18nKey, englishFallback]; tSafe renders the fallback until translated.
function _variantCopy(variant, candidateName) {
  const name = String(candidateName || '').trim();
  switch (variant) {
    case 'provisional':
      return {
        icon: '🌱',
        badge: ['scan.guidance.provisional.badge', 'Is this correct?'],
        title: name
          ? ['scan.guidance.provisional.title', 'We may have identified this as ' + name + '.']
          : ['scan.guidance.provisional.titleGeneric', 'We have a possible match.'],
        body: ['scan.guidance.provisional.body',
          'Confirm the plant so we can check its health, or scan again for a clearer match.'],
        hint: ['scan.guidance.provisional.hint', 'Best guess — please confirm'],
      };
    case 'lowId':
      // Scan Intelligence §2 — when the provider returned REAL candidates, lead
      // with the top one instead of a dead-end "couldn't name this plant".
      // The badge stays "Not sure yet" so the lower certainty is never hidden.
      return name
        ? {
          icon: '🔍',
          badge: ['scan.guidance.lowId.badge', 'Not sure yet'],
          title: ['scan.guidance.provisional.title', 'We may have identified this as ' + name + '.'],
          body: ['scan.guidance.lowId.pick',
            'Not fully sure. Pick the matching plant below, or retake a closer photo.'],
          hint: ['scan.confidence.low', 'Low confidence'],
        }
        : {
          icon: '🔍',
          badge: ['scan.guidance.lowId.badge', 'Not sure yet'],
          title: ['scan.guidance.lowId.title', "We couldn't confidently name this plant."],
          body: ['scan.guidance.lowId.body',
            'The photo looks fine — we just are not certain. A closer photo of a single leaf, or an agronomist, can confirm it.'],
          hint: ['scan.confidence.low', 'Low confidence'],
        };
    case 'notPlant':
      return {
        icon: '🪴',
        badge: ['scan.guidance.notPlant.badge', 'No plant detected'],
        title: ['scan.guidance.notPlant.title', "This doesn't look like a plant."],
        body: ['scan.guidance.notPlant.body',
          'Point the camera at a leaf, crop, or whole plant and scan again.'],
        hint: ['scan.confidence.low', 'Low confidence'],
      };
    case 'error':
      return {
        icon: '📡',
        badge: ['scan.guidance.error.badge', 'Service unavailable'],
        title: ['scan.guidance.error.title', "We couldn't reach the plant service."],
        body: ['scan.guidance.error.body', 'This is temporary. Please scan again in a moment.'],
        hint: ['scan.confidence.low', 'Low confidence'],
      };
    case 'image':
    default:
      return {
        icon: '⚠️',
        badge: ['scanQuality.photoNeedsClearerView', 'Clearer photo needed'],
        title: ['scan.guidance.title', "We couldn't confidently identify this crop."],
        body: ['scan.guidance.body', 'Take one close photo of a single leaf in daylight.'],
        hint: ['scan.confidence.low', 'Low confidence'],
      };
  }
}

export default function ScanGuidanceCard({
  reasons,            // PhotoQualityEngine coaching keys / texts (the honest "why")
  confidencePct,      // numeric 0–100 from the scan envelope (may be absent)
  stages,             // [{ key, labelKey, labelDefault, state:'done'|'skipped'|'pending' }]
  showTreatmentLockedNote,
  variant,            // 'image' (default) | 'lowId' | 'provisional' | 'notPlant' | 'error'
  candidateName,      // top candidate name, shown in the provisional/lowId title
  onConfirm,          // (provisional | lowId) confirm the top candidate → health assessment
  confirming,         // true while the confirm request is in flight
  confirmedHealth,    // { state, conditions } once confirmation completed (hides the confirm CTA)
  contractMismatch,   // §6 — requiresConfirmation but no candidates: fail closed, do not blame the photo
  alternates,         // Scan Intelligence §2 — remaining ranked candidates [{taxonId, commonName, scientificName}]
  onConfirmAlternate, // (taxonId) → confirm THAT candidate instead of the top one
  onRejectAll,        // §4 "none of these" → records farmer_rejected_species
  onRetake,
  onUpload,
  onSaveForReview,
}) {
  // Scan Intelligence §2 — the confirm path now also unlocks on lowId: a valid
  // photo with sub-provisional candidates shows the provider's REAL ranked list
  // and lets the farmer (looking at the plant) resolve it. No threshold change.
  const _provisionalConfirm = (variant === 'provisional' || variant === 'lowId')
    && _isFn(onConfirm) && !confirmedHealth;
  const _alternates = _arr(alternates).slice(0, 2);
  const _healthLabel = (st) => (
    st === 'HEALTHY' ? tSafe('scan.health.noDisease', 'No obvious disease detected')
      : st === 'ISSUE_POSSIBLE' ? tSafe('scan.health.issue', 'Possible issue found')
      : st === 'HEALTH_PROVIDER_ERROR' || st === 'PROVIDER_ERROR' ? tSafe('scan.health.error', 'Health check unavailable')
      : tSafe('scan.health.uncertain', 'Health not certain yet'));
  const _reasons = _arr(reasons).slice(0, 3);
  const _stages = _arr(stages);
  const _pct = _num(confidencePct);
  const _pctShown = _pct === null ? null : Math.max(0, Math.min(100, Math.round(_pct)));
  const _copy = _variantCopy(variant, candidateName);
  return (
    <section className="ff-scan-result" style={S.card} data-testid="scan-guidance-card" role="region"
      data-variant={variant || 'image'}
      aria-label={tSafe(_copy.title[0], _copy.title[1])}>
      <style>{CARD_CSS}</style>

      <div style={S.badge} data-testid="scan-guidance-status">
        <span aria-hidden="true">{_copy.icon}</span>
        <span>{tSafe(_copy.badge[0], _copy.badge[1])}</span>
      </div>

      <h3 style={S.title} data-testid="scan-guidance-title">
        {tSafe(_copy.title[0], _copy.title[1])}
      </h3>
      <p style={S.body}>
        {contractMismatch
          ? tSafe('scan.contractMismatch', 'Plant possibilities were found, but the result could not be displayed.')
          : tSafe(_copy.body[0], _copy.body[1])}
      </p>

      {/* Identification confidence — the REAL number, with a proportional bar. Rendered
          only when the envelope actually carried a confidence value (never invent 0%). */}
      {_pctShown !== null ? (
        <div style={S.confBlock} data-testid="scan-guidance-confidence">
          <div style={S.confLabel}>{tSafe('scan.guidance.identConfidence', 'Identification confidence')}</div>
          <div style={S.confValue}>{_pctShown}%</div>
          <div style={S.confTrack} aria-hidden="true">
            <div style={S.confFill(_pctShown)} />
          </div>
          <div style={S.confHint}>{tSafe(_copy.hint[0], _copy.hint[1])}</div>
        </div>
      ) : null}

      {/* Why we're unsure — measured photo-coaching reasons only (empty ⇒ hidden). */}
      {_reasons.length > 0 ? (
        <ul style={S.list} data-testid="scan-guidance-reasons">
          {_reasons.map((k, i) => <li key={'gr-' + i}>{tSafe(k, k)}</li>)}
        </ul>
      ) : null}

      {/* Processing checklist — STAGES + state only, no latency (none is measured
          client-side). Honest done / skipped / pending. */}
      {_stages.length > 0 ? (
        <div style={S.timeline} data-testid="scan-guidance-timeline">
          <p style={S.timelineHead}>{tSafe('scan.guidance.timeline', 'What we checked')}</p>
          {_stages.map((s, i) => {
            const st = s && s.state === 'done' ? 'done'
              : s && s.state === 'failed' ? 'failed'
              : s && s.state === 'skipped' ? 'skipped' : 'pending';
            return (
              <div key={s && s.key ? s.key : 'stage-' + i}
                className="ff-scan-stage"
                style={{ ...S.stageRow, animationDelay: (i * 60) + 'ms' }}
                data-testid={'scan-stage-' + (s && s.key ? s.key : i)}
                data-state={st}>
                <span style={S.stageDot(st)} aria-hidden="true">{_stageGlyph(st)}</span>
                <span style={S.stageLabel(st)}>
                  {tSafe(s && s.labelKey, (s && s.labelDefault) || '')}
                </span>
                {/* State-aware note (spec §3): the caller maps the canonical
                    server state → row copy, so a valid-image low-confidence row
                    NEVER says "Waiting for a clearer photo". Falls back to the
                    generic per-state suffix only when no note is supplied. */}
                {s && (s.noteKey || s.noteDefault) ? (
                  <span style={{ ...S.stageState,
                    color: st === 'failed' ? C.failed : st === 'done' ? C.done
                      : st === 'skipped' ? C.muted : C.pending }}>
                    {tSafe(s.noteKey, s.noteDefault || '')}
                  </span>
                ) : st === 'failed' ? (
                  <span style={{ ...S.stageState, color: C.failed }}>
                    {tSafe('scan.stage.failed', "Couldn't identify")}
                  </span>
                ) : st === 'pending' ? (
                  <span style={S.stageState}>
                    {tSafe('scan.stage.pending', 'Waiting for a clearer photo')}
                  </span>
                ) : st === 'skipped' ? (
                  <span style={{ ...S.stageState, color: C.muted }}>
                    {tSafe('scan.stage.skipped', 'Not available')}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
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

      {/* Button hierarchy — Primary: Scan Again · Secondary: Choose from Gallery ·
          Tertiary: Ask an Agronomist (escalates to human expert review). The tertiary
          is rendered only when a real handler is wired, so it is never a dead no-op. */}
      {/* Confirmed health outcome — replaces the confirm CTA after a farmer
          confirms a provisional candidate (P4/P7). Honest label only; treatment
          stays gated behind the recommendation-level policy. */}
      {confirmedHealth ? (
        <div style={S.confBlock} data-testid="scan-guidance-health">
          <div style={S.confLabel}>{tSafe('scan.health.title', 'Health check')}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.title, margin: '4px 0' }}>
            {_healthLabel(confirmedHealth.state)}
          </div>
          {_arr(confirmedHealth.conditions).slice(0, 2).map((c, i) => (
            <div key={'cond-' + i} style={S.confHint}>
              {String((c && c.name) || '')}
              {c && typeof c.confidence === 'number' ? ' — ' + Math.round(c.confidence * 100) + '%' : ''}
            </div>
          ))}
        </div>
      ) : null}

      <div style={S.actions}>
        {_provisionalConfirm ? (
          <button type="button" className="ff-scan-btn" style={S.btnPrimary}
            data-testid="scan-guidance-confirm"
            aria-label={tSafe('scan.guidance.confirmYes', 'Yes, this is correct')}
            onClick={confirming ? undefined : onConfirm}
            disabled={!!confirming}>
            {confirming
              ? tSafe('scan.guidance.confirming', 'Checking health…')
              : tSafe('scan.guidance.confirmYes', 'Yes, this is correct')}
          </button>
        ) : null}

        {/* Scan Intelligence §2 — alternative REAL candidates (never invented;
            these are the provider's remaining ranked results). Tapping one
            confirms THAT candidate. §4 — "None of these" records the honest
            farmer_rejected_species signal. */}
        {_provisionalConfirm && _alternates.length && _isFn(onConfirmAlternate) ? (
          <div data-testid="scan-guidance-alternates" style={{ marginTop: 8 }}>
            <div style={S.confLabel}>{tSafe('scan.guidance.alternates', 'Other possibilities')}</div>
            {_alternates.map((a) => (
              <button key={String(a.taxonId)} type="button" className="ff-scan-btn" style={S.btnSecondary}
                data-testid={'scan-guidance-alt-' + String(a.taxonId)}
                onClick={confirming ? undefined : () => onConfirmAlternate(a.taxonId)}
                disabled={!!confirming}>
                {String(a.commonName || a.scientificName || '')}
              </button>
            ))}
          </div>
        ) : null}
        {_provisionalConfirm && _isFn(onRejectAll) ? (
          <button type="button" className="ff-scan-btn" style={S.btnTertiary}
            data-testid="scan-guidance-reject-all"
            onClick={confirming ? undefined : onRejectAll}
            disabled={!!confirming}>
            {tSafe('scan.guidance.noneOfThese', 'None of these')}
          </button>
        ) : null}
        <button type="button" className="ff-scan-btn"
          style={_provisionalConfirm ? S.btnSecondary : S.btnPrimary}
          data-testid="scan-guidance-retake"
          aria-label={tSafe('scan.guidance.scanAgain', 'Scan Again')}
          onClick={_isFn(onRetake) ? onRetake : undefined}
          disabled={!_isFn(onRetake)}>
          {tSafe('scan.guidance.scanAgain', 'Scan Again')}
        </button>

        <button type="button" className="ff-scan-btn" style={S.btnSecondary}
          data-testid="scan-guidance-upload"
          aria-label={tSafe('scan.guidance.chooseGallery', 'Choose from Gallery')}
          onClick={_isFn(onUpload) ? onUpload : undefined}
          disabled={!_isFn(onUpload)}>
          {tSafe('scan.guidance.chooseGallery', 'Choose from Gallery')}
        </button>

        {/* Tertiary "Ask an Agronomist" IS the save-for-review escalation (human
            expert review) — the friendlier farmer-facing label for it. The testid
            keeps the trust-gate contract name (sprint #214) since the action is
            unchanged; only the wording is warmer. */}
        {_isFn(onSaveForReview) ? (
          <button type="button" className="ff-scan-btn" style={S.btnTertiary}
            data-testid="scan-guidance-save-review"
            aria-label={tSafe('scan.guidance.askAgronomist', 'Ask an Agronomist')}
            onClick={onSaveForReview}>
            {tSafe('scan.guidance.askAgronomist', 'Ask an Agronomist')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
