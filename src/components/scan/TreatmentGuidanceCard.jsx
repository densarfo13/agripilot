/**
 * TreatmentGuidanceCard — renders the structured output of
 * `treatmentEngine.recommendTreatment` below the scan result.
 *
 *   <TreatmentGuidanceCard
 *     issue={result.possibleIssue}
 *     confidence={result.confidence}
 *     activeExperience={result.contextType}
 *     country={profile?.country}
 *     scaleType={result.scaleType}
 *     repeatedIssue={false}
 *     cropName={profile?.crop}
 *     onAddToPlan={handleAddTreatmentTasks}
 *   />
 *
 * Layout (spec §3, §4, §6, §7)
 *   1. "What to do now" — immediateActions (non-chemical first)
 *   2. "Treatment guidance" — safeChemicalGuidance (class-only)
 *   3. "Prevention" — preventionTips
 *   4. Warning banner (when triggered)
 *   5. Disclaimer
 *   6. Add to Today's Plan CTA
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — engine call is wrapped.
 *   * `onAddToPlan(actions)` receives only the immediate
 *     non-chemical actions (spec §9 — never add chemical tasks).
 *   * Renders null when issue is missing or "Looks healthy".
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { recommendTreatment } from '../../core/treatmentEngine.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  card:    'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.10)',
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  green:   '#22C55E',
  greenInk: '#062714',
  amber:   '#F59E0B',
  amberBg: 'rgba(245,158,11,0.10)',
  amberBd: 'rgba(245,158,11,0.32)',
};

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12, margin: '12px 0' },
  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: 16,
    color: C.ink,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.inkSoft },
  title:   { margin: 0, fontSize: 15, fontWeight: 800 },
  list:    { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55 },
  li:      { padding: '2px 0' },
  body:    { margin: 0, fontSize: 14, lineHeight: 1.55, color: C.ink },
  warn: {
    background: C.amberBg, border: `1px solid ${C.amberBd}`,
    borderRadius: 14, padding: 14,
    color: '#FCD34D', fontSize: 13, lineHeight: 1.5,
  },
  disclaimer: {
    fontSize: 12, color: C.inkSoft, lineHeight: 1.5,
    padding: '10px 14px',
    border: `1px dashed ${C.border}`, borderRadius: 12,
  },
  cta: {
    appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
    background: C.green, color: C.greenInk, border: 'none',
    padding: '12px 16px', borderRadius: 12,
    fontSize: 14, fontWeight: 800, minHeight: 44,
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.55, cursor: 'not-allowed' },
};

export default function TreatmentGuidanceCard({
  issue,
  confidence,
  activeExperience,
  country,
  region,
  cropName,
  plantName,
  scaleType,
  repeatedIssue,
  weather,
  onAddToPlan,
  alreadyAddedTasks,
}) {
  useTranslation();

  const guidance = useMemo(() => {
    if (!issue) return null;
    if (String(issue).toLowerCase() === 'looks healthy') return null;
    try {
      return recommendTreatment({
        possibleIssue: issue,
        confidence,
        cropName,
        plantName,
        activeExperience,
        country,
        region,
        weather,
        scaleType,
        repeatedIssue,
      });
    } catch { return null; }
  }, [
    issue, confidence, activeExperience, country, region,
    cropName, plantName, scaleType, repeatedIssue, weather,
  ]);

  if (!guidance) return null;

  function handleAddToPlan() {
    try {
      trackEvent('treatment_add_to_plan', {
        treatmentType: guidance.treatmentType,
        contextType:   guidance.contextType,
      });
    } catch { /* swallow */ }
    if (typeof onAddToPlan === 'function') {
      try { onAddToPlan(guidance.immediateActions.slice(0, 2)); }
      catch { /* swallow */ }
    }
  }

  return (
    <div style={S.wrap} data-testid="treatment-guidance" data-type={guidance.treatmentType}>
      {/* What to do now (spec §3) */}
      <section style={S.card}>
        <span style={S.eyebrow}>
          {tStrict('treatment.now.eyebrow', 'What to do now')}
        </span>
        <h3 style={S.title}>
          {tStrict('treatment.now.title', 'Try these first \u2014 no chemicals needed')}
        </h3>
        <ul style={S.list}>
          {guidance.immediateActions.map((a, i) => (
            <li key={i} style={S.li}>{a}</li>
          ))}
        </ul>
      </section>

      {/* Safe chemical guidance (spec §4) — only when category supports it */}
      {guidance.safeChemicalGuidance ? (
        <section style={S.card} data-testid="treatment-chemical-guidance">
          <span style={S.eyebrow}>
            {tStrict('treatment.chem.eyebrow', 'If the issue spreads')}
          </span>
          <h3 style={S.title}>
            {tStrict('treatment.chem.title', 'Treatment guidance')}
          </h3>
          <p style={S.body}>{guidance.safeChemicalGuidance}</p>
        </section>
      ) : null}

      {/* Prevention */}
      {Array.isArray(guidance.preventionTips) && guidance.preventionTips.length > 0 ? (
        <section style={S.card} data-testid="treatment-prevention">
          <span style={S.eyebrow}>
            {tStrict('treatment.prevent.eyebrow', 'Prevention')}
          </span>
          <h3 style={S.title}>
            {tStrict('treatment.prevent.title', 'Reduce the chance next time')}
          </h3>
          <ul style={S.list}>
            {guidance.preventionTips.map((p, i) => (
              <li key={i} style={S.li}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Warning (spec §6) */}
      {guidance.warning ? (
        <section style={S.warn} data-testid="treatment-warning">
          {guidance.warning}
        </section>
      ) : null}

      {/* Add to Today's Plan (spec §9 — non-chemical actions only) */}
      {typeof onAddToPlan === 'function' ? (
        <button
          type="button"
          onClick={handleAddToPlan}
          disabled={!!alreadyAddedTasks}
          style={alreadyAddedTasks
            ? { ...S.cta, ...S.ctaDisabled }
            : S.cta}
          data-testid="treatment-add-to-plan"
        >
          {alreadyAddedTasks
            ? tStrict('treatment.added', 'Added to Today\u2019s Plan')
            : tStrict('treatment.addToPlan', 'Add these actions to Today\u2019s Plan')}
        </button>
      ) : null}

      {/* Disclaimer (spec §7) */}
      <p style={S.disclaimer} data-testid="treatment-disclaimer">
        {guidance.disclaimer}
      </p>
    </div>
  );
}
