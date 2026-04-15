/**
 * TaskCard — unified task rendering component for farmer home.
 *
 * Renders from a TaskViewModel ONLY. Never accesses raw task fields.
 * Two variants:
 *   simple   — large icon, centered, voice-prominent, one CTA (BasicFarmerHome)
 *   standard — horizontal layout, icon + text + CTA (NextActionCard / guided mode)
 *
 * Rules:
 *   - All display text comes from viewModel (title, descriptionShort, ctaLabel)
 *   - All styling comes from viewModel.stateStyle (no hardcoded colors)
 *   - No component-level translation logic
 *   - No severity computation
 */
import { assertIsViewModel } from '../../domain/tasks/devAssertions.js';
import { speakText, languageToVoiceCode } from '../../lib/voice.js';

export default function TaskCard({ viewModel, variant, language, t, onCta, onVoice, ctaDisabled }) {
  assertIsViewModel({ viewModel }, 'TaskCard');

  if (!viewModel) return null;

  const isSimple = variant === 'simple';
  const sty = viewModel.stateStyle;
  const isAllDone = viewModel.actionKey === 'all_done';
  const blocked = sty.ctaDisabled || ctaDisabled;

  function handleVoice() {
    if (onVoice) return onVoice();
    if (viewModel.voiceText) {
      try { speakText(viewModel.voiceText, languageToVoiceCode(language)); } catch {}
    }
  }

  // ─── SIMPLE VARIANT (BasicFarmerHome) ─────────────────────
  if (isSimple) {
    return (
      <div style={{ ...S.simpleCard, border: sty.cardBorder }} data-testid="task-card-simple">
        {/* Large icon */}
        <div style={{ ...S.simpleIconWrap, background: viewModel.iconBg }}>
          <span style={S.simpleIcon}>{viewModel.icon}</span>
        </div>

        {/* Title */}
        <div style={S.simpleTitle}>{viewModel.title}</div>

        {/* Voice — prominent in simple mode */}
        <button onClick={handleVoice} style={S.voiceBtn} type="button">
          {'\uD83D\uDD0A'} {t('common.listen')}
        </button>

        {/* CTA */}
        <button
          onClick={onCta}
          disabled={isAllDone || blocked}
          style={
            isAllDone ? S.ctaDone
            : blocked ? S.ctaBlocked
            : { ...S.ctaSimple, background: sty.ctaBg, boxShadow: sty.ctaShadow }
          }
          type="button"
          data-testid="task-card-cta"
        >
          {viewModel.ctaLabel}
        </button>
      </div>
    );
  }

  // ─── STANDARD VARIANT (NextActionCard / guided mode) ──────
  return (
    <div
      style={{
        ...S.standardCard,
        border: viewModel.isAlert ? sty.cardBorderAlert : sty.cardBorder,
      }}
      data-testid="task-card-standard"
    >
      {/* Icon + text row */}
      <div style={S.standardRow}>
        <div style={{ ...S.standardIconWrap, background: viewModel.iconBg }}>
          <span style={S.standardIcon}>{viewModel.icon}</span>
        </div>
        <div style={S.standardText}>
          <div style={S.standardTitle}>{viewModel.title}</div>
          {viewModel.descriptionShort && (
            <div style={S.standardDesc}>{viewModel.descriptionShort}</div>
          )}
        </div>
      </div>

      {/* Stage chip (if stage action) */}
      {viewModel.stageInfo && (
        <div style={S.stageChip}>
          <span>{viewModel.stageInfo.emoji}</span>
          <span>{viewModel.stageInfo.label}</span>
          {viewModel.stageInfo.daysSinceUpdate > 1 && (
            <span style={S.stageAge}>
              {t('guided.daysAgo', { days: viewModel.stageInfo.daysSinceUpdate })}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onCta}
        disabled={isAllDone || blocked}
        style={
          isAllDone ? S.ctaSecondary
          : blocked ? S.ctaBlocked
          : { ...S.ctaStandard, background: sty.ctaBg, boxShadow: sty.ctaShadow }
        }
        type="button"
        data-testid="task-card-cta"
      >
        {viewModel.ctaLabel}
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const S = {
  // ═══ Simple variant ═══
  simpleCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '2rem 1.5rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    textAlign: 'center',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  simpleIconWrap: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleIcon: { fontSize: '3rem', lineHeight: 1 },
  simpleTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    lineHeight: 1.3,
    maxWidth: '20rem',
  },
  voiceBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.625rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#6F8299',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  ctaSimple: {
    width: '100%',
    padding: '1rem',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.5rem',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  ctaBlocked: {
    width: '100%',
    padding: '1rem',
    background: 'rgba(255,255,255,0.06)',
    color: '#6F8299',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'not-allowed',
    minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.5rem',
    opacity: 0.7,
  },
  ctaDone: {
    width: '100%',
    padding: '0.875rem',
    background: 'transparent',
    color: '#9FB3C8',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.5rem',
  },

  // ═══ Standard variant ═══
  standardCard: {
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    padding: '1.5rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  standardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.875rem',
  },
  standardIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  standardIcon: { fontSize: '1.75rem', lineHeight: 1 },
  standardText: { flex: 1, minWidth: 0 },
  standardTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  standardDesc: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    lineHeight: 1.5,
    marginTop: '0.25rem',
  },
  stageChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '0.75rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 600,
  },
  stageAge: {
    fontSize: '0.6875rem',
    color: '#FCD34D',
    fontWeight: 500,
    marginLeft: '0.25rem',
  },
  ctaStandard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '1.25rem',
    padding: '1rem',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '1.0625rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  ctaSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '1.25rem',
    padding: '0.875rem',
    background: 'transparent',
    color: '#9FB3C8',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
};
