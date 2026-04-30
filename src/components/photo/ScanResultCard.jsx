/**
 * ScanResultCard — the four-section result UI required by
 * spec §10:
 *
 *   Possible issue  : <short answer>
 *   Confidence      : Low / Medium / High
 *   What to do now  : <action steps>
 *   When to get help: <condition>
 *
 *   Buttons: Play answer · Retake · Contact our team · Save
 *
 * Strict-rule audit
 *   • "Possible issue" wording is enforced by the engine — we
 *     only render what we receive. Confidence pill never
 *     overstates: 'high' renders as "High confidence" not
 *     "Confirmed".
 *   • Voice playback is gated by FEATURE_VOICE_RESPONSE. When
 *     off the play button is hidden — the text result still
 *     renders.
 *   • Save / Retake / Contact are wired through props so the
 *     parent decides routing.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import { speakAnswer, stopSpeaking } from '../../utils/voiceEngine.js';

const CONFIDENCE_LABEL_KEY = {
  low:    'photo.confidence.low',
  medium: 'photo.confidence.medium',
  high:   'photo.confidence.high',
};

const CONFIDENCE_FALLBACK = {
  low:    'Low confidence',
  medium: 'Medium confidence',
  high:   'High confidence',
};

const CONFIDENCE_TONE = {
  low:    { background: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.32)', color: '#FCD34D' },
  medium: { background: 'rgba(59,130,246,0.14)', borderColor: 'rgba(59,130,246,0.32)', color: '#93C5FD' },
  high:   { background: 'rgba(34,197,94,0.14)',  borderColor: 'rgba(34,197,94,0.32)',  color: '#86EFAC' },
};

export default function ScanResultCard({
  result,
  language = 'en',
  imageDataUrl = '',
  onRetake,
  onContact,
  onSave,
  saved = false,
}) {
  if (!result) return null;

  const voiceEnabled = isFeatureEnabled('FEATURE_VOICE_RESPONSE');

  const confidence = result.confidence || 'low';
  const confidenceLabel = tSafe(
    CONFIDENCE_LABEL_KEY[confidence],
    CONFIDENCE_FALLBACK[confidence],
  );
  const confidenceTone = CONFIDENCE_TONE[confidence] || CONFIDENCE_TONE.low;

  function handlePlay() {
    if (!result.localizedResponse) return;
    speakAnswer(result.localizedResponse, language, {});
  }
  function handleStop() { stopSpeaking(); }

  return (
    <div style={S.card} data-testid="scan-result-card">
      {imageDataUrl && (
        <img src={imageDataUrl} alt="" style={S.image} />
      )}

      {/* Possible issue */}
      <div style={S.section}>
        <p style={S.sectionLabel}>
          {tSafe('photo.result.possibleIssue', 'Possible issue')}
        </p>
        <p style={S.sectionBody}>{result.possibleIssue}</p>
      </div>

      {/* Confidence pill */}
      <div style={S.confidenceRow}>
        <span style={{ ...S.pill, ...confidenceTone }}>
          {confidenceLabel}
        </span>
      </div>

      {/* What to do now */}
      {result.recommendedAction && (
        <div style={S.section}>
          <p style={S.sectionLabel}>
            {tSafe('photo.result.recommendedAction', 'What to do now')}
          </p>
          <p style={S.sectionBody}>{result.recommendedAction}</p>
        </div>
      )}

      {/* Safety warning (only when present) */}
      {result.safetyWarning && (
        <div style={S.warning} data-testid="scan-safety-warning">
          {result.safetyWarning}
        </div>
      )}

      {/* When to get help */}
      {result.seekHelp && (
        <div style={S.section}>
          <p style={S.sectionLabel}>
            {tSafe('photo.result.seekHelp', 'When to get help')}
          </p>
          <p style={S.sectionBody}>{result.seekHelp}</p>
        </div>
      )}

      {/* Action row */}
      <div style={S.actions}>
        {voiceEnabled && (
          <>
            <button
              type="button"
              onClick={handlePlay}
              style={{ ...S.btn, ...S.btnPrimary }}
              data-testid="scan-play"
            >
              {'\uD83D\uDD0A '}{tSafe('voice.playAnswer', 'Play answer')}
            </button>
            <button
              type="button"
              onClick={handleStop}
              style={{ ...S.btn, ...S.btnGhost }}
              data-testid="scan-stop"
            >
              {tSafe('voice.stop', 'Stop')}
            </button>
          </>
        )}
        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="scan-retake"
          >
            {tSafe('photo.retake', 'Retake')}
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={onContact}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="scan-contact"
          >
            {tSafe('help.contactTeam', 'Contact our team')}
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            style={{
              ...S.btn,
              ...(saved ? S.btnDisabled : S.btnGhost),
            }}
            data-testid="scan-save"
          >
            {saved
              ? tSafe('photo.savedToHistory', 'Saved')
              : tSafe('photo.saveToHistory', 'Save to farm history')}
          </button>
        )}
      </div>
    </div>
  );
}

const S = {
  card: {
    padding: '0.875rem',
    borderRadius: 14,
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.18)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  image: {
    width: '100%',
    maxHeight: 220,
    borderRadius: 10,
    objectFit: 'cover',
  },
  section: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  sectionLabel: {
    margin: 0,
    fontSize: '0.6875rem',
    color: '#9FB3C8',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sectionBody: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.45,
    color: '#F1F5F9',
  },
  confidenceRow: { display: 'flex', flexWrap: 'wrap' },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  warning: {
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.5rem 0.875rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 36,
  },
  btnPrimary: { background: '#22C55E', color: '#062714', borderColor: '#22C55E' },
  btnGhost:   { background: 'transparent', color: '#EAF2FF' },
  btnDisabled: {
    background: 'transparent', color: '#9FB3C8',
    cursor: 'not-allowed', opacity: 0.7,
  },
};
