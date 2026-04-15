/**
 * WeatherStatusCard — tiny weather context bar on farmer home.
 *
 * Shows max 2 lines:
 *   Line 1: icon + short weather status
 *   Line 2: actionable recommendation
 *
 * Design rule: weather bar provides CONTEXT, not dominance.
 * It should be visually lighter than the task card and CTA.
 * Red only appears for true block/danger states.
 *
 * Consumes pre-computed WeatherGuidance from the decision engine.
 */
import VoicePromptButton from './VoicePromptButton.jsx';
import { resolvePromptId } from '../services/voicePrompts.js';

// Lighter backgrounds — weather bar should NOT dominate
const STATUS_COLORS = {
  safe:    'rgba(34,197,94,0.05)',
  caution: 'rgba(250,204,21,0.05)',
  warning: 'rgba(250,204,21,0.06)',   // amber, not red — only danger uses red
  danger:  'rgba(239,68,68,0.08)',
};

const STATUS_BORDERS = {
  safe:    'rgba(34,197,94,0.10)',
  caution: 'rgba(250,204,21,0.12)',
  warning: 'rgba(250,204,21,0.15)',   // amber, not red
  danger:  'rgba(239,68,68,0.20)',
};

export default function WeatherStatusCard({ guidance, t, isBasic }) {
  if (!guidance) return null;

  const recommendation = t(guidance.recommendationKey, guidance.params);
  const reason = t(guidance.reasonKey, guidance.params);
  const voiceText = t(guidance.voiceKey, guidance.params);

  // Don't render if translation key returned as-is (missing key)
  const hasRecommendation = recommendation && recommendation !== guidance.recommendationKey;

  if (!hasRecommendation) return null;

  // Basic mode: icon + very short text only
  if (isBasic) {
    return (
      <div style={{ ...S.basicWrap, background: STATUS_COLORS[guidance.status] || STATUS_COLORS.safe }}>
        <span style={S.basicIcon}>{guidance.icon}</span>
        <span style={S.basicText}>{recommendation}</span>
      </div>
    );
  }

  // Standard mode: compact bar with voice
  return (
    <div style={{ ...S.bar, background: STATUS_COLORS[guidance.status], borderColor: STATUS_BORDERS[guidance.status] }}>
      <span style={S.icon}>{guidance.icon}</span>
      <div style={S.textCol}>
        <span style={S.recommendation}>{recommendation}</span>
        {reason && reason !== guidance.reasonKey && (
          <span style={S.reason}>{reason}</span>
        )}
      </div>
      {voiceText && voiceText !== guidance.voiceKey && (
        <VoicePromptButton promptId={resolvePromptId(guidance.voiceKey)} text={voiceText} label={t('common.listen')} compact />
      )}
    </div>
  );
}

const S = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid',
    minHeight: '40px',
  },
  icon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
    minWidth: 0,
  },
  recommendation: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.3,
  },
  reason: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.38)',
    lineHeight: 1.3,
  },
  // Basic mode — lighter than standard, context only
  basicWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
  },
  basicIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  basicText: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.65)',
  },
};
