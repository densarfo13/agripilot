/**
 * ScanResultCard — renders the result of a single scan + the four
 * spec-required action buttons.
 *
 * Spec safety wording (§14)
 *   • "Possible issue" — never "confirmed disease".
 *   • Footer disclaimer always visible.
 *   • shouldSeekHelp surfaces a prominent "Get help" callout.
 *
 * Buttons (per spec §6)
 *   • Retake photo            → onRetake
 *   • Ask Farroway            → optional handler; falls back to
 *                                a /today navigate
 *   • Add to Today's Plan     → only when scanToTask flag is on
 *   • Save to history         → onSave; the parent persists
 *
 * Visible labels via tStrict; the `experience` prop flips
 * "Plant" / "Crop" wording where it appears.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { playVoice } from '../../utils/voicePlayer.js';
import { twiVoice } from '../../i18n/twiVoice.js';
import VoiceReplayButton from '../voice/VoiceReplayButton.jsx';

const STYLES = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.3 },
  pill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  pillLow:    { background: 'rgba(245,158,11,0.18)', color: '#FDE68A', border: '1px solid rgba(245,158,11,0.45)' },
  pillMedium: { background: 'rgba(14,165,233,0.18)', color: '#7DD3FC', border: '1px solid rgba(14,165,233,0.45)' },
  pillHigh:   { background: 'rgba(34,197,94,0.18)',  color: '#86EFAC', border: '1px solid rgba(34,197,94,0.45)' },
  metaLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  explain: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    lineHeight: 1.4,
  },
  helpBlock: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 1.5,
  },
  buttonsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    fontWeight: 700,
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 1.5,
  },
};

function _confidencePill(level) {
  if (level === 'high')   return { ...STYLES.pill, ...STYLES.pillHigh };
  if (level === 'medium') return { ...STYLES.pill, ...STYLES.pillMedium };
  return { ...STYLES.pill, ...STYLES.pillLow };
}

function _confidenceLabel(level) {
  if (level === 'high')   return tStrict('scan.confidence.high',   'High confidence');
  if (level === 'medium') return tStrict('scan.confidence.medium', 'Medium confidence');
  return tStrict('scan.confidence.low', 'Low confidence');
}

export default function ScanResultCard({
  result,
  experience = 'generic',
  onRetake,
  onAsk,
  onAddTasks,
  onSave,
  alreadySaved = false,
  alreadyAddedTasks = false,
}) {
  // Subscribe to language change so labels refresh.
  const { lang } = useTranslation();

  // Twi voice guidance — auto-play `twiVoice.scan.issue` once per
  // mount when:
  //   • twiVoiceGuidance flag is on
  //   • active language is Twi (or scan was tagged Twi by the
  //     engine — both are accepted signals)
  // The mute hook + VoiceReplayButton handle silencing + repeat.
  const playedRef = useRef(false);
  useEffect(() => {
    if (playedRef.current) return;
    if (!result) return;
    if (!isFeatureEnabled('twiVoiceGuidance')) return;
    const isTwi = lang === 'tw' || result?.language === 'tw';
    if (!isTwi) return;
    playedRef.current = true;
    try { playVoice(twiVoice.scan.issue, 'tw'); }
    catch { /* never propagate */ }
  }, [result, lang]);

  if (!result) return null;
  const scanToTaskOn = isFeatureEnabled('scanToTask');

  return (
    <article style={STYLES.card} data-testid="scan-result-card" data-confidence={result.confidence}>
      <div style={STYLES.header}>
        <h3 style={STYLES.title}>{result.possibleIssue || tStrict('scan.fallback.headline', 'Needs closer inspection')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Twi voice replay — self-hides when the feature
              flag is off, the language isn't Twi, or the user
              has muted voice guidance. */}
          {isFeatureEnabled('twiVoiceGuidance') && (lang === 'tw' || result?.language === 'tw') ? (
            <VoiceReplayButton text={twiVoice.scan.issue} lang="tw" />
          ) : null}
          <span style={_confidencePill(result.confidence)}>
            {_confidenceLabel(result.confidence)}
          </span>
        </div>
      </div>

      {result.explanation ? (
        <div>
          <span style={STYLES.metaLabel}>{tStrict('scan.whatItMeans', 'What it means')}</span>
          <p style={{ ...STYLES.explain, marginTop: 4 }}>{result.explanation}</p>
        </div>
      ) : null}

      {Array.isArray(result.recommendedActions) && result.recommendedActions.length > 0 ? (
        <div>
          <span style={STYLES.metaLabel}>{tStrict('scan.whatToDo', 'What to do now')}</span>
          <ul style={{ ...STYLES.list, marginTop: 4 }}>
            {result.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      ) : null}

      {result.shouldSeekHelp ? (
        <div style={STYLES.helpBlock} data-testid="scan-seek-help">
          <strong style={{ display: 'block', marginBottom: 4 }}>
            {tStrict('scan.seekHelpTitle', 'When to get help')}
          </strong>
          {tStrict(
            'scan.seekHelpBody',
            'If the damage is severe, spreading, or your plants are dying, contact a local expert.'
          )}
        </div>
      ) : null}

      {result.safetyWarning ? (
        <div style={STYLES.helpBlock}>{result.safetyWarning}</div>
      ) : null}

      <div style={STYLES.buttonsRow}>
        {typeof onRetake === 'function' ? (
          <button type="button" onClick={onRetake} style={STYLES.btn} data-testid="scan-result-retake">
            {tStrict('scan.retake', 'Retake')}
          </button>
        ) : null}
        {typeof onAsk === 'function' ? (
          <button type="button" onClick={onAsk} style={STYLES.btn} data-testid="scan-result-ask">
            {tStrict('scan.askFarroway', 'Ask Farroway')}
          </button>
        ) : null}
        {scanToTaskOn && typeof onAddTasks === 'function' ? (
          <button
            type="button"
            onClick={onAddTasks}
            style={{ ...STYLES.btn, ...STYLES.btnPrimary }}
            disabled={alreadyAddedTasks}
            data-testid="scan-result-add-tasks"
          >
            {alreadyAddedTasks
              ? tStrict('scan.tasksAdded', 'Added to Today\u2019s Plan')
              : tStrict('scan.addToToday', 'Add to Today\u2019s Plan')}
          </button>
        ) : null}
        {typeof onSave === 'function' ? (
          <button
            type="button"
            onClick={onSave}
            style={STYLES.btn}
            disabled={alreadySaved}
            data-testid="scan-result-save"
          >
            {alreadySaved
              ? tStrict('scan.saved', 'Saved')
              : tStrict('scan.save', 'Save to history')}
          </button>
        ) : null}
      </div>

      <p style={STYLES.disclaimer}>
        {tStrict(
          'scan.disclaimer',
          'Farroway provides guidance based on the photo and available information. Results are not guaranteed. Contact a local expert for severe or spreading issues.'
        )}
      </p>
    </article>
  );
}
