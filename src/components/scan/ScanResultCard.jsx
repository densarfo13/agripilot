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

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { playVoice } from '../../utils/voicePlayer.js';
import { twiVoice } from '../../i18n/twiVoice.js';
import VoiceReplayButton from '../voice/VoiceReplayButton.jsx';
import UpgradePrompt from '../monetization/UpgradePrompt.jsx';
import ScanShareButton from '../growth/ScanShareButton.jsx';
import ChannelShareButtons from '../growth/ChannelShareButtons.jsx';
import ScanContinueCard from '../growth/ScanContinueCard.jsx';
import ScanRetryTips from './ScanRetryTips.jsx';
import { trackFirstAction } from '../../analytics/funnelEvents.js';
import { enforceHighTrustScanResult } from '../../core/scanResultPolicy.js';

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
  // High-trust scan output (spec \u00a71): "Possible issue" eyebrow
  // sits ABOVE the issue title so the user reads the framing
  // before the diagnosis-shaped string.
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
  },
  // Escalation block (spec \u00a75) \u2014 amber, conditional, distinct
  // from the red shouldSeekHelp "danger" block.
  escalateBlock: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FCD34D',
    fontSize: 13,
    lineHeight: 1.5,
  },
  // Follow-up pill (spec \u00a71) \u2014 a single concise reassurance
  // line. Visually quieter than the action list.
  followUpBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC',
    fontSize: 13,
    lineHeight: 1.5,
  },
  followUpDot: {
    width: 6, height: 6, borderRadius: 999, background: '#22C55E',
    flex: '0 0 6px',
  },
  // "Check to confirm:" verification block (spec \u00a76) \u2014 only
  // shown when the policy module has yes/no items for the
  // category (suppressed for healthy / unknown).
  verifyBlock: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.85)',
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

  // Funnel optimisation §10: stamp first-action on first scan
  // result render. trackFirstAction is idempotent across mounts
  // so a re-render or a returning user with prior actions is a
  // no-op.
  const firstActionRef = useRef(false);
  useEffect(() => {
    if (firstActionRef.current) return;
    if (!result) return;
    firstActionRef.current = true;
    try {
      trackFirstAction('scan_completed', {
        crop: result?.crop || result?.plantId || null,
        hasIssue: !!(result?.possibleIssue || result?.issue),
      });
    } catch { /* swallow */ }
    // Final feedback-loop spec §1: a scan result is a meaningful
    // action — fire-and-forget request to the global host. Host
    // self-rate-limits (max 1 per session) and self-suppresses on
    // setup paths so this never spams the user.
    try {
      import('../../analytics/userFeedbackStore.js')
        .then((m) => m.requestUserFeedback && m.requestUserFeedback('scan'))
        .catch(() => { /* swallow */ });
    } catch { /* never propagate */ }
  }, [result]);

  if (!result) return null;
  const scanToTaskOn = isFeatureEnabled('scanToTask');

  // High-trust scan output (spec \u00a71\u2013\u00a76): run the raw result
  // through the policy module so we ALWAYS render the same
  // structured shape regardless of which path produced the
  // verdict (real ML, hybrid fallback, 2-second timer fallback).
  // The policy:
  //   \u2022 sanitises forbidden wording ("confirmed disease" \u2192
  //     "possible issue", exact dosage \u2192 "Follow label
  //     instructions.")
  //   \u2022 caps action bullets at 3
  //   \u2022 provides escalation copy keyed off issue category +
  //     garden/farm context
  //   \u2022 builds the "Check this again tomorrow" follow-up line
  //   \u2022 returns optional "Check to confirm:" yes/no items
  // The original `result` is preserved for callers that read
  // engine-only fields (scanId, suggestedTasks, meta).
  const policy = useMemo(() => {
    try {
      return enforceHighTrustScanResult(result, {
        contextType:     experience === 'farm' || experience === 'farmer' ? 'farm'
                       : (experience === 'backyard' || experience === 'garden' ? 'garden' : 'generic'),
        plantOrCropName: result?.plantName || result?.cropName || result?.crop || null,
      });
    } catch {
      // Never throw \u2014 fall back to the raw issue + an empty plan
      // so the card still renders something safe.
      return {
        possibleIssue:       result?.possibleIssue || 'Needs closer inspection',
        confidence:          result?.confidence || 'low',
        whyExplanation:      '',
        recommendedActions:  [],
        escalationCopy:      '',
        followUpCopy:        '',
        followUpTask:        null,
        verificationChecks:  [],
        contextType:         'generic',
        category:            'unknown',
        disclaimer:          '',
      };
    }
  }, [result, experience]);

  return (
    <article
      style={STYLES.card}
      data-testid="scan-result-card"
      data-confidence={policy.confidence}
      data-context={policy.contextType}
      data-category={policy.category}
    >
      <div style={STYLES.header}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Spec \u00a71 \u2014 "Possible issue" eyebrow ALWAYS renders so
              the user reads the framing before the issue name. */}
          <span style={STYLES.eyebrow} data-testid="scan-eyebrow">
            {tStrict('scan.eyebrow.possibleIssue', 'Possible issue')}
          </span>
          <h3 style={STYLES.title}>
            {policy.possibleIssue || tStrict('scan.fallback.headline', 'Needs closer inspection')}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Twi voice replay — self-hides when the feature
              flag is off, the language isn't Twi, or the user
              has muted voice guidance. */}
          {isFeatureEnabled('twiVoiceGuidance') && (lang === 'tw' || result?.language === 'tw') ? (
            <VoiceReplayButton text={twiVoice.scan.issue} lang="tw" />
          ) : null}
          <span style={_confidencePill(policy.confidence)}>
            {_confidenceLabel(policy.confidence)}
          </span>
        </div>
      </div>

      {/* Spec \u00a71 "Why" \u2014 one-paragraph plain-language reason.
          Skips the section entirely when the engine has nothing
          to say so the layout doesn't render an empty label. */}
      {policy.whyExplanation ? (
        <div>
          <span style={STYLES.metaLabel}>{tStrict('scan.why', 'Why')}</span>
          <p style={{ ...STYLES.explain, marginTop: 4 }} data-testid="scan-why">
            {policy.whyExplanation}
          </p>
        </div>
      ) : null}

      {/* Spec \u00a71 "What to do now" \u2014 2\u20133 action bullets, sanitised
          and capped by the policy module. */}
      {policy.recommendedActions.length > 0 ? (
        <div>
          <span style={STYLES.metaLabel}>{tStrict('scan.whatToDo', 'What to do now')}</span>
          <ul style={{ ...STYLES.list, marginTop: 4 }} data-testid="scan-actions">
            {policy.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      ) : null}

      {/* Spec \u00a75 "When to escalate" \u2014 conditional copy keyed off
          category + garden/farm context. Suppressed for the
          healthy branch where there's nothing to escalate. */}
      {policy.escalationCopy ? (
        <div style={STYLES.escalateBlock} data-testid="scan-escalate">
          <strong style={{ display: 'block', marginBottom: 4 }}>
            {tStrict('scan.whenToEscalate', 'When to escalate')}
          </strong>
          {policy.escalationCopy}
        </div>
      ) : null}

      {/* Spec \u00a76 (optional) "Check to confirm:" \u2014 2\u20133 yes/no
          items the user can mentally tick before acting. Hidden
          when the category has no checks (healthy / unknown). */}
      {policy.verificationChecks.length > 0 ? (
        <div style={STYLES.verifyBlock} data-testid="scan-verify-checks">
          <strong style={{ display: 'block', marginBottom: 4 }}>
            {tStrict('scan.checkToConfirm', 'Check to confirm:')}
          </strong>
          <ul style={{ ...STYLES.list, marginTop: 4, color: 'rgba(255,255,255,0.85)' }}>
            {policy.verificationChecks.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      ) : null}

      {/* Spec \u00a71 "Follow-up" \u2014 single reassurance line. The
          actual follow-up TASK is added when the user taps Add to
          Today's Plan; this block is the human-readable promise. */}
      {policy.followUpCopy ? (
        <div style={STYLES.followUpBlock} data-testid="scan-followup">
          <span style={STYLES.followUpDot} aria-hidden="true" />
          <span><strong>{tStrict('scan.followUp', 'Follow-up')}:</strong> {policy.followUpCopy}</span>
        </div>
      ) : null}

      {/* Legacy "When to get help" red block kept as a SEPARATE
          danger signal \u2014 fires only when the engine flips
          shouldSeekHelp (e.g. damage severe + spreading). The
          escalation block above is the conditional 2\u20133-day path;
          this block is the immediate "see a human" path. */}
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
        {/* User growth §1: share-this-scan CTA. Self-hides when
            `userGrowth` is off or the device has no share path. */}
        <ScanShareButton result={result} lang={lang} />
      </div>

      {/* User acquisition §2: explicit per-channel share buttons
          (WhatsApp / Facebook / SMS / Copy). Self-hides when
          `userAcquisition` is off. Sits below the canonical
          action row so it never displaces the spec buttons. */}
      <ChannelShareButtons
        text={(() => {
          const issue = String(result?.issue || result?.diagnosis || '').trim();
          return issue
            ? `Possible issue: ${issue}. Scanned with Farroway.`
            : 'Plant scan from Farroway.';
        })()}
        context="scan_result"
      />

      <p style={STYLES.disclaimer}>
        {tStrict(
          'scan.disclaimer',
          'Farroway provides guidance based on the photo and available information. Results are not guaranteed. Contact a local expert for severe or spreading issues.'
        )}
      </p>

      {/* Robust journey §4: retry tips when the result is unclear
          (low confidence / fallback / no diagnosis). Mounts above
          the continue + upgrade prompts so the user sees the path
          to a better photo first. */}
      <ScanRetryTips result={result} onRetake={onRetake} />

      {/* User acquisition §4: habit-conversion CTA pointing the
          user from one scan to a daily plan. Self-hides when
          `userAcquisition` is off. */}
      <ScanContinueCard result={result} />

      {/* Monetization upgrade prompt — flag-gated; self-hides for
          pro users and when `monetization` is off. Never blocks the
          scan result; sits below the card content as a follow-on. */}
      <UpgradePrompt context="scan_result" style={{ marginTop: 12 }} />
    </article>
  );
}
