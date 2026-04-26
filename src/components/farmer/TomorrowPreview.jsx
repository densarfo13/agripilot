/**
 * TomorrowPreview — small return-loop card for the farmer "done"
 * state (spec §9). Replaces the dead-end "All done for now" with
 * a one-line reason to come back tomorrow.
 *
 * Usage:
 *   const trigger = getReturnTrigger({ stage, crop, weather });
 *   <TomorrowPreview trigger={trigger} t={t} />
 *
 * Rendering contract:
 *   • One primary line (Tomorrow: …)
 *   • Optional weather-driven secondary line (e.g. "Bring tools
 *     under cover tonight — rain expected")
 *   • A single CTA chip — tapping it routes back into the
 *     daily-loop via props (onOpenTomorrow / onReviewProgress)
 *
 * Visually matches the existing dark farmer theme: frosted panel,
 * subtle border, one-tap button. No new dependencies.
 *
 * Block-level i18n: uses `resolveBlock` so the whole card renders
 * in one language — never a Hindi header with an English body.
 */

import React from 'react';

import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { resolveBlock }   from '../../lib/i18n/blockResolve.js';

export default function TomorrowPreview({
  trigger,
  onOpenTomorrow,
  onReviewProgress,
  compact = false,
}) {
  const { t } = useTranslation();
  if (!trigger || !trigger.primary) return null;

  const keyMap = {
    heading:      'farmer.return.heading',
    primary:      trigger.primary.textKey,
    when:         trigger.primary.whenKey,
    cta:          trigger.cta === 'review_progress'
                    ? 'farmer.return.cta.review'
                    : 'farmer.return.cta.open_tomorrow',
  };
  const fallbackMap = {
    heading:      'Next',
    primary:      trigger.primary.text,
    when:         trigger.primary.when,
    cta:          trigger.cta === 'review_progress' ? 'Review progress' : 'Open tomorrow\u2019s task',
  };
  const secondaryKeyMap = trigger.secondary
    ? { text: trigger.secondary.textKey }
    : null;
  const secondaryFallbackMap = trigger.secondary
    ? { text: trigger.secondary.text }
    : null;

  const block = resolveBlock(t, keyMap, fallbackMap);
  const secondaryBlock = secondaryKeyMap
    ? resolveBlock(t, secondaryKeyMap, secondaryFallbackMap)
    : null;

  const handleCta = () => {
    if (trigger.cta === 'review_progress' && typeof onReviewProgress === 'function') {
      onReviewProgress();
    } else if (typeof onOpenTomorrow === 'function') {
      onOpenTomorrow();
    }
  };

  return (
    <section
      data-testid="tomorrow-preview"
      data-translated={block.translated ? 'yes' : 'no'}
      style={compact ? S.compact : S.panel}
      role="status"
    >
      <div style={S.headingRow}>
        <span aria-hidden="true" style={S.icon}>{'\u23F0'}</span>
        <span style={S.heading}>{block.values.heading}</span>
      </div>
      <p style={S.primary}>
        <strong style={S.when}>{block.values.when}: </strong>
        <span>{block.values.primary}</span>
      </p>
      {secondaryBlock && secondaryBlock.values.text && (
        <p style={S.secondary} data-testid="tomorrow-preview-secondary">
          {secondaryBlock.values.text}
        </p>
      )}
      <button
        type="button"
        onClick={handleCta}
        style={S.cta}
        data-testid="tomorrow-preview-cta"
      >
        {block.values.cta}
      </button>
    </section>
  );
}

const S = {
  panel: {
    padding: '14px 16px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: 6,
    marginTop: 12, boxSizing: 'border-box',
  },
  compact: {
    padding: '10px 12px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: 4,
    marginTop: 8, boxSizing: 'border-box',
  },
  headingRow:  { display: 'flex', alignItems: 'center', gap: 8 },
  icon:        { fontSize: '0.95rem' },
  heading: {
    fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.4,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
  },
  primary:     { margin: 0, fontSize: '0.9375rem', lineHeight: 1.35 },
  when:        { color: '#93C5FD' },
  secondary:   { margin: 0, fontSize: '0.8125rem',
                 color: 'rgba(255,255,255,0.7)' },
  cta: {
    marginTop: 8, alignSelf: 'flex-start',
    padding: '6px 12px', borderRadius: 999,
    background: 'rgba(34,197,94,0.12)', color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.4)',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
    minHeight: 36,  // touch target
  },
};
