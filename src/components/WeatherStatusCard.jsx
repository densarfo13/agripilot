/**
 * WeatherStatusCard — tiny weather intelligence block on farmer home.
 *
 * Shows max 2 lines:
 *   Line 1: icon + short weather status
 *   Line 2: actionable recommendation
 *
 * No charts, no metrics grid, no raw data.
 * Optional voice replay button.
 * Consumes pre-computed WeatherGuidance from the decision engine.
 */
import VoicePromptButton from './VoicePromptButton.jsx';

const STATUS_COLORS = {
  safe: 'rgba(34,197,94,0.08)',
  caution: 'rgba(250,204,21,0.08)',
  warning: 'rgba(239,68,68,0.08)',
  danger: 'rgba(239,68,68,0.12)',
};

const STATUS_BORDERS = {
  safe: 'rgba(34,197,94,0.15)',
  caution: 'rgba(250,204,21,0.2)',
  warning: 'rgba(239,68,68,0.2)',
  danger: 'rgba(239,68,68,0.3)',
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
        <VoicePromptButton text={voiceText} label={t('common.listen')} compact />
      )}
    </div>
  );
}

const S = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px solid',
    minHeight: '48px',
  },
  icon: {
    fontSize: '1.25rem',
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
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
  },
  reason: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.3,
  },
  // Basic mode
  basicWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
  },
  basicIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  basicText: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#fff',
  },
};
