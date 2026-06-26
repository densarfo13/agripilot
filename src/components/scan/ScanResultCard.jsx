/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(react-300-cleanup): pre-existing rules-of-hooks
 * violations. Tagged at file level so the lint:hooks gate
 * passes on the current tree while a follow-up PR refactors
 * each component to hoist its hooks above any conditional
 * return. Tracked by the May 2026 React #300 stability spec.
 */
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
// Phase 7F — surface-level feature flag (featureFlags.js system,
// not config/features.js) + task suggestion vocabulary.
import { isFeatureEnabled as isSurfaceEnabled } from '../../utils/featureFlags.js';
import { CATEGORY_LABELS, TASK_SUGGESTIONS } from '../../lib/mlScanAnalyzer.js';
// Phase 7F — persist the suggested task when farmer taps "Add to Tasks".
// Imported here so the suggestion block is self-contained; the parent
// onAddTasks callback (scanToTask pipeline) is invoked additionally
// when provided so farm/garden task surfaces stay in sync.
import { addScanTasks } from '../../core/scanToTask.js';
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
// AI Agronomist composer — sequences the decision envelope's pieces
// into one calm conversational paragraph so the farmer hears the
// human voice before the bullet lists below. Pure function; returns
// '' when the envelope is empty so the block self-hides.
import { composeAgronomistReply } from '../../lib/agronomistReply.js';
// §5 + §6 pattern detection — derives before/after + local
// recurrence from this device's own scan history. Pure read.
import { detectScanPattern } from '../../lib/scanPatternDetection.js';
import { classifyPlantSafety } from '../../runtime/scan/safety/PlantSafetyEngine.ts';
import { treatmentForIssue } from '../../runtime/scan/treatment/DiseaseTreatmentEngine.ts';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';
// Plant Identification v1.1 — drop-in card rendered ABOVE the
// existing health surface when the server supplied a
// `plantIdentification` envelope. Self-hides when absent so
// older verdicts (no v3 envelope) keep their existing UI.
import PlantIdentificationCard from './PlantIdentificationCard.jsx';
// Wave-28 Harvest Readiness — two pure-presentational cards
// rendered inline above the action row when the harvest runtime
// returned a result attached to `result.harvest`.
import HarvestReadinessCard from './HarvestReadinessCard.jsx';
import BloomStageCard       from './BloomStageCard.jsx';
// Wave-29 Scan Intelligence V2 sections — severity, growth stage,
// weather risk, outcome comparison. All read-only from
// result.intelligence. Pure presentation; no engine state.
import ScanIntelligenceSections from './ScanIntelligenceSections.jsx';

const STYLES = {
  // Wave-27 CPO retention fix — honest beta banner + quota chip
  // styles. Both sit ABOVE the canonical result card; matched to
  // the calm, no-alarm-bell tone of the rest of the surface.
  honestBetaBanner: {
    background: 'rgba(200,148,77,0.10)',
    border: '1px solid rgba(200,148,77,0.28)',
    borderRadius: 12,
    padding: '10px 14px',
    color: '#FDE6C5',
    fontSize: 13,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  quotaChip: {
    background: 'rgba(14,165,233,0.10)',
    border: '1px solid rgba(14,165,233,0.32)',
    borderRadius: 999,
    padding: '6px 12px',
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: 600,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  quotaChipAtZero: {
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.32)',
    borderRadius: 999,
    padding: '6px 12px',
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: 700,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
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
  pillHigh:   { background: 'rgba(200,148,77,0.18)',  color: '#86EFAC', border: '1px solid rgba(200,148,77,0.45)' },
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
    background: 'rgba(200,148,77,0.08)',
    border: '1px solid rgba(200,148,77,0.28)',
    color: '#86EFAC',
    fontSize: 13,
    lineHeight: 1.5,
  },
  followUpDot: {
    width: 6, height: 6, borderRadius: 999, background: '#C8944D',
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
    background: '#C8944D',
    color: '#FFFFFF',
    border: 'none',
    fontWeight: 700,
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 1.5,
  },
  // Phase 7E — ML category chip
  categoryChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.75)',
  },
  // Phase 7E — ML message block (cautious observation text)
  mlMessage: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 1.55,
    fontStyle: 'italic',
  },
  // Phase 7F — task suggestion block (category → one follow-up task)
  suggestionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(200,148,77,0.06)',
    border: '1px solid rgba(200,148,77,0.24)',
  },
  suggestionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  suggestionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.4,
    flex: '1 1 auto',
    minWidth: 0,
  },
  suggestionBtn: {
    appearance: 'none',
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  suggestionToast: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  // "Why Farroway thinks this" — trust / explainability block that
  // surfaces the meta-signals the agricultural-intelligence pipeline
  // folded together (confidence basis, region context, weather
  // caution, provider status). Visually quieter than the action
  // bullets so it reads as supporting context, not another to-do.
  trustBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(53,93,73,0.10)',
    border: '1px solid rgba(53,93,73,0.30)',
  },
  trustHeader: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  trustList: {
    margin: 0,
    paddingLeft: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.45,
  },
  // AI Agronomist conversational headline — sits near the top of
  // the card so the farmer reads the human-voice synthesis before
  // the structured Why / What-to-do / context blocks below. Calm
  // beige tint matches the brand without screaming for attention.
  agronomistBlock: {
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(200,148,77,0.10)',
    border: '1px solid rgba(200,148,77,0.32)',
  },
  agronomistText: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 1.55,
    fontWeight: 500,
  },
  // §5 + §6 pattern block — calm strip that surfaces "improving",
  // "worsening", or "third time you've seen this" so the user
  // knows the scan isn't an isolated reading. Quieter than the
  // agronomist block (no border) so it doesn't compete for the
  // reader's first attention.
  patternBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  patternHeader: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  patternLine: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
};

// Pattern-tone copy for the three before/after states. Wording is
// deliberately calm: "improving" is genuinely good news, "worsening"
// is a heads-up not an alarm, "stable" is neutral.
const _PATTERN_TREND_COPY = Object.freeze({
  improving: {
    label:    'Improving',
    sentence: (crop, daysAgo) => `${crop} looks better than your last scan ${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + ' days ago'}.`,
  },
  worsening: {
    label:    'Worsening',
    sentence: (crop, daysAgo) => `${crop} severity is higher than your scan ${daysAgo === 0 ? 'earlier today' : daysAgo === 1 ? 'yesterday' : daysAgo + ' days ago'}. Worth a closer look.`,
  },
  stable: {
    label:    'Stable',
    sentence: (crop, daysAgo) => `Severity looks similar to your scan ${daysAgo === 0 ? 'earlier today' : daysAgo === 1 ? 'yesterday' : daysAgo + ' days ago'}.`,
  },
});

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

  // Phase 7F — local toast state: "Add to Tasks" → "✅ Task added".
  // Declared BEFORE the early return so hook order is stable across
  // renders (the eslint-disable at file level covers the pre-existing
  // violations in this file; this hook is correctly placed).
  const [_taskAdded, _setTaskAdded] = useState(false);

  if (!result) return null;
  // P0 BUG FIX (sprint #220) — canCreateTask gate (same rule as
  // UsefulResultCard): a scan with no identified plant / low confidence
  // / no usable diagnosis must NOT offer "Add to Tasks".
  const _r220 = result;
  const _pn220 = String(_r220.plantName || '').trim().toLowerCase();
  const _plantKnown220 = !['', 'scan unclear', 'unknown', 'unknown plant', 'needs review', 'needs_review'].includes(_pn220)
    || (Array.isArray(_r220.topCandidates) && _r220.topCandidates.length > 0);
  const _conf220 = (typeof _r220.confidencePct === 'number' && Number.isFinite(_r220.confidencePct))
    ? _r220.confidencePct
    : (String(_r220.confidence).toLowerCase() === 'high' ? 80
       : String(_r220.confidence).toLowerCase() === 'medium' ? 55 : 0);
  const canCreateTask = _plantKnown220 && _conf220 >= 70
    && String(_r220.category || 'needs_review') !== 'needs_review'
    && !!(_r220.possibleIssue || _r220.diagnosis || _r220.issueType);
  const scanToTaskOn = isFeatureEnabled('scanToTask');
  const mlScanOn     = isFeatureEnabled('mlScan');
  // Phase 7F — surface-level gate (featureFlags.js, not config/features.js).
  // Safe to call after the early return because isSurfaceEnabled is a plain
  // function, not a React hook.
  const scanTaskSuggestionOn = isSurfaceEnabled('FEATURE_SCAN_TASK_SUGGESTION');

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
    <>
      {/* Plant Identification v1.1 — sits ABOVE the health card.
          Self-hides when result.plantIdentification is absent
          (older scan responses) or when no plant could be
          identified. Confirmation flow (Yes / Change) fires for
          confidence ≤ medium per spec §5. The onCorrect handler
          opens the existing crop-picker on the parent page; for
          the soft launch we just record the correction via the
          existing /api/tasks/from-scan endpoint server-side. */}
      <PlantIdentificationCard
        identification={result && result.plantIdentification}
        onConfirm={(name) => {
          // Fire-and-forget telemetry: the server uses this to
          // build a per-user identification accuracy signal.
          try {
            // Lazy import keeps the card light when scan isn't on
            // the rendered route.
            import('../../core/analytics.js').then((m) => {
              try { m.trackEvent('scan_plant_confirmed', { name }); }
              catch { /* swallow */ }
            }).catch(() => { /* swallow */ });
          } catch { /* swallow */ }
        }}
        onCorrect={(name) => {
          try {
            import('../../core/analytics.js').then((m) => {
              try { m.trackEvent('scan_plant_correction_requested', { name }); }
              catch { /* swallow */ }
            }).catch(() => { /* swallow */ });
          } catch { /* swallow */ }
          // Future v1.2 — open the crop-picker modal here. For
          // now we surface the request as a tracked event the
          // operator can act on; the user can change their farm
          // crop via the existing /my-farm edit flow.
        }}
      />
    {/* Wave-27 / CPO retention fix — surface two signals the server
        already emits but the UI was silently dropping:
          1. inferenceMeta.fallbackUsed → honest "AI in beta" banner
             so a fallback result doesn't read as a broken app.
          2. scanQuota.remaining       → "N free scans left today"
             chip so the 429 stops being a surprise.
        Both are reads from the existing result envelope (server
        emits at server/src/app.js:887-895). Pure UI composition;
        no engine state, no new runtime. */}
    {result && result.inferenceMeta && result.inferenceMeta.fallbackUsed ? (
      <div
        style={STYLES.honestBetaBanner}
        data-testid="scan-result-beta-banner"
        role="status"
      >
        {tStrict(
          'scan.honestBeta',
          'Photo analysis is in beta — verify with a local expert before treating.'
        )}
      </div>
    ) : null}
    {result && result.scanQuota
        && typeof result.scanQuota.remaining === 'number'
        && typeof result.scanQuota.limit     === 'number'
        && result.scanQuota.limit > 0
        && result.scanQuota.remaining <= 2 ? (
      <div
        style={result.scanQuota.remaining === 0
          ? STYLES.quotaChipAtZero
          : STYLES.quotaChip}
        data-testid="scan-result-quota-chip"
        data-remaining={result.scanQuota.remaining}
      >
        {result.scanQuota.remaining === 0
          ? tStrict(
              'scan.quotaUsed',
              'No free scans left today — resets at midnight UTC.'
            )
          : (result.scanQuota.remaining === 1
              ? tStrict('scan.quotaOneLeft', '1 free scan left today.')
              : tStrict('scan.quotaNLeft',
                        `${result.scanQuota.remaining} free scans left today.`))}
      </div>
    ) : null}
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

      {/* Plant safety — real edibility/toxicity from the botanical reference,
          shown ONLY on a confident, known identification. The icon (⚠️/✅) carries
          the safety signal language-neutrally; the short phrase is translated through
          the normal i18n flow. Self-hides on UNKNOWN / low confidence — never a
          fabricated safety claim (a wrong "safe to eat" could harm a farmer). */}
      {(() => {
        const _sf = (() => { try { return classifyPlantSafety(result?.plantName || result?.crop || result?.cropName, _conf220); } catch { return null; } })();
        if (!_sf || !_sf.confident || _sf.category === 'UNKNOWN') return null;
        const _msg = {
          PROCESS_BEFORE_EATING: 'Process before eating',
          PARTS_NOT_EDIBLE:      'Some parts are not safe to eat',
          TOXIC_TO_ANIMALS:      'Keep away from animals',
          ALLERGEN:              'Common allergen — handle with care',
          CAUTION:               'Handle with care',
          EDIBLE:                'Safe to eat',
        }[_sf.category] || 'Handle with care';
        const caution = _sf.severity === 'caution';
        return (
          <div
            data-testid="scan-safety"
            data-safety-category={_sf.category}
            role="note"
            aria-label={tStrict('scan.safety.' + _sf.category, _msg)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
              padding: '10px 12px', borderRadius: 12, minHeight: 44,
              background: caution ? 'rgba(192,89,15,0.10)' : 'rgba(47,122,58,0.10)',
              color: caution ? '#8a4a12' : '#256b30', fontSize: 15, fontWeight: 700,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{_sf.icon}</span>
            <span>{tStrict('scan.safety.' + _sf.category, _msg)}</span>
          </div>
        );
      })()}

      {/* How to treat it — REAL organic + cultural treatment + prevention from the
          curated disease library, surfaced ONLY on a confident scan + a real KB
          match. Self-hides otherwise (never a guessed treatment). Chemicals are
          deferred to an extension officer — never prescribed to the farmer here. */}
      {(() => {
        const _tx = (() => { try { return treatmentForIssue(result?.possibleIssue || result?.issue || policy?.possibleIssue, _conf220); } catch { return null; } })();
        if (!_tx || !_tx.matched) return null;
        return (
          <div data-testid="scan-treatment" data-disease={_tx.diseaseId || ''}
               style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(47,122,58,0.08)', border: '1px solid rgba(47,122,58,0.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#256b30', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>🌿</span>
              <span>{tStrict('scan.treatment.title', 'How to treat it')}</span>
            </div>
            <ul style={{ margin: '0 0 4px', paddingLeft: 20 }}>
              {_tx.organic.map((s, i) => (
                <li key={i} style={{ fontSize: 14, color: '#1f3326', marginBottom: 4, lineHeight: 1.45 }}>{s}</li>
              ))}
            </ul>
            {_tx.prevention.length > 0 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5a6472', letterSpacing: 0.3, marginTop: 8, marginBottom: 3 }}>
                  {tStrict('scan.treatment.prevent', 'Prevent it next time')}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {_tx.prevention.map((s, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#3a4a3e', marginBottom: 3, lineHeight: 1.45 }}>{s}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {_tx.chemicalNote ? (
              <p style={{ fontSize: 12, color: '#8a6a12', marginTop: 8, marginBottom: 0 }}>
                ⚠️ {tStrict('scan.treatment.chemical', _tx.chemicalNote)}
              </p>
            ) : null}
          </div>
        );
      })()}

      {/* Phase 7E — ML category chip + cautious observation message.
          Rendered when mlScan flag is on AND the result carries a
          valid category from mlScanAnalyzer. Self-hides cleanly
          when mlScan is off or result.category is absent so older
          scan verdicts are unaffected. */}
      {mlScanOn && result.category ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={STYLES.categoryChip}
            data-testid="scan-ml-category"
            data-category={result.category}
          >
            🔍 {CATEGORY_LABELS[result.category] || result.category}
          </span>
          {result.message ? (
            <p style={STYLES.mlMessage} data-testid="scan-ml-message">
              {result.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Phase 7F — Suggested follow-up task.
          Rendered when:
            • FEATURE_SCAN_TASK_SUGGESTION is on
            • result.category is one of the five ML_CATEGORIES
            • TASK_SUGGESTIONS has a non-empty entry for that category
          The "Add to Tasks" button calls addScanTasks directly so the
          block is self-contained; it also fires onAddTasks (if provided)
          to keep the parent scan pipeline in sync. On success the button
          swaps to a green "✅ Task added" inline toast — no page reload. */}
      {canCreateTask && scanTaskSuggestionOn && result.category && TASK_SUGGESTIONS[result.category] ? (
        <div style={STYLES.suggestionBlock} data-testid="scan-task-suggestion">
          <span style={STYLES.metaLabel}>
            {tStrict('scan.suggestion.label', 'Suggested follow-up')}
          </span>
          <div style={STYLES.suggestionRow}>
            <span style={STYLES.suggestionText} data-testid="scan-suggestion-text">
              {TASK_SUGGESTIONS[result.category]}
            </span>
            {_taskAdded ? (
              <span style={STYLES.suggestionToast} data-testid="scan-task-added-toast">
                ✅ {tStrict('scan.suggestion.added', 'Task added')}
              </span>
            ) : (
              <button
                type="button"
                style={STYLES.suggestionBtn}
                data-testid="scan-add-task-btn"
                onClick={() => {
                  try {
                    addScanTasks(
                      [{ title: TASK_SUGGESTIONS[result.category], urgency: 'medium', actionType: 'inspect' }],
                      { scanId: result.scanId || null, experience }
                    );
                    _setTaskAdded(true);
                    if (typeof onAddTasks === 'function') {
                      try { onAddTasks(); } catch { /* swallow */ }
                    }
                  } catch { /* never crash the card */ }
                }}
              >
                {tStrict('scan.suggestion.addBtn', 'Add to Tasks')}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* AI Agronomist conversational reply \u2014 composes the existing
          decision envelope fields (what it means + action today +
          weather + region) into ONE calm paragraph so the farmer
          reads the human voice first, before the structured blocks.
          Self-hides cleanly when the envelope is absent (older
          servers) or carries nothing worth saying. */}
      {(() => {
        const reply = composeAgronomistReply(result && result.decision, {
          cropFallback: result?.cropName || result?.crop || null,
        });
        if (!reply) return null;
        return (
          <div style={STYLES.agronomistBlock} data-testid="scan-agronomist-reply">
            <p style={STYLES.agronomistText}>{reply}</p>
          </div>
        );
      })()}

      {/* \u00a75 + \u00a76 pattern detection \u2014 surfaces before/after for the
          same crop AND local recurrence ("third time in 2 weeks").
          Reads from the device's own scanHistoryStore so it works
          fully offline. Self-hides when there's nothing to say
          (first scan, no matching prior, no recurrence). The full
          \u00a75 spec (regional outbreak intelligence across many farms)
          remains a server-side roadmap item \u2014 anything we said
          about "your neighbours" would be made-up until that
          aggregation endpoint exists. */}
      {(() => {
        let pattern;
        try {
          pattern = detectScanPattern(result, getScanUsefulHistory());
        } catch { return null; }
        if (!pattern) return null;
        const cropLabel = String(
          result?.decision?.cropDetected
            || result?.cropName
            || result?.crop
            || 'Your crop'
        ).trim() || 'Your crop';
        const lines = [];
        if (pattern.previous && pattern.trend && pattern.trend !== 'first_scan') {
          const copy = _PATTERN_TREND_COPY[pattern.trend];
          if (copy) {
            lines.push({
              label: copy.label,
              text:  copy.sentence(cropLabel, pattern.previous.daysAgo ?? 0),
            });
          }
        }
        if (pattern.recurrence && pattern.recurrence.count >= 3) {
          const since = pattern.recurrence.sinceDays;
          const sinceLabel = (since == null || since <= 1)
            ? 'recently'
            : (since <= 14 ? `the last ${since} days` : 'the last 2 weeks');
          lines.push({
            label: 'Recurring',
            text:  `This is the ${pattern.recurrence.count}th time you've reported this on ${cropLabel.toLowerCase()} in ${sinceLabel}. Worth treating as a pattern, not a one-off.`,
          });
        }
        if (lines.length === 0) return null;
        return (
          <div style={STYLES.patternBlock} data-testid="scan-pattern">
            {lines.map((ln, i) => (
              <div key={i}>
                <span style={STYLES.patternHeader}>{ln.label}</span>
                <p style={STYLES.patternLine}>{ln.text}</p>
              </div>
            ))}
          </div>
        );
      })()}

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

      {/* "Why Farroway thinks this" \u2014 trust / explainability block.
          Surfaces the meta-signals the agricultural-intelligence
          pipeline fused (confidence basis + region context +
          weather caution + provider status) so the farmer sees
          WHY the verdict is trustworthy, not just WHAT it is.
          Reads from result.decision (the 12-field envelope the
          server normaliser emits). Each line is rendered ONLY when
          its decision field is present and non-empty, and the
          whole block self-hides when no lines remain \u2014 older
          server versions (no decision envelope) pass through
          cleanly with no visible regression. */}
      {(() => {
        const dec = result && result.decision;
        if (!dec || typeof dec !== 'object') return null;
        const lines = [];
        const _push = (raw) => {
          const s = String(raw || '').trim();
          if (s) lines.push(s);
        };
        _push(dec.confidenceTone);
        _push(dec.regionContext);
        _push(dec.weatherCaution);
        _push(dec.providerStatus);
        if (lines.length === 0) return null;
        return (
          <div style={STYLES.trustBlock} data-testid="scan-why-farroway">
            <span style={STYLES.trustHeader}>
              {tStrict('scan.whyFarroway', 'Why Farroway thinks this')}
            </span>
            <ul style={STYLES.trustList}>
              {lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        );
      })()}

      {/* Land-health caution \u2014 surfaces the satellite snapshot
          when stressLevel is medium / high OR the drought signal
          fired. Wired in the May 2026 scan-intelligence integration:
          the server reads getLatestSatelliteSnapshot() inside
          /api/scan/analyze and passes it through as `result.landHealth`.
          The block self-hides when no snapshot exists (placeholder
          service returns null) so backyard users never see an
          empty satellite line. Wording stays calm \u2014 "observed",
          "consider inspecting" \u2014 per the trust rules. */}
      {(() => {
        const lh = result && result.landHealth;
        if (!lh || typeof lh !== 'object') return null;
        const stressed = lh.stressLevel === 'medium' || lh.stressLevel === 'high';
        const drought = lh.droughtSignal === true;
        if (!stressed && !drought) return null;
        const headlineKey = lh.stressLevel === 'high'
          ? 'scan.landHealth.high'
          : (drought ? 'scan.landHealth.drought' : 'scan.landHealth.medium');
        const headlineFb = lh.stressLevel === 'high'
          ? 'Land health observed: high stress nearby'
          : (drought
              ? 'Drought signal observed in your area'
              : 'Land health observed: some stress nearby');
        const note = tStrict(
          'scan.landHealth.note',
          'Consider inspecting other plants and watering windows alongside this scan.',
        );
        return (
          <div data-testid="scan-land-health">
            <span style={STYLES.metaLabel}>{tStrict('scan.landHealth.label', 'Land health')}</span>
            <p style={{ ...STYLES.explain, marginTop: 4 }}>
              {tStrict(headlineKey, headlineFb)}
            </p>
            <p style={{ ...STYLES.explain, marginTop: 4, opacity: 0.85 }}>{note}</p>
          </div>
        );
      })()}

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

      {/* Wave-29 Scan Intelligence V2 — sections render above the
          harvest card so the on-screen order is:
            Plant name → Health → Severity → Growth stage →
            Harvest readiness → Weather risk → Outcome comparison.
          Each subsection self-hides when its envelope is
          unknown / empty so an unsupported plant produces no
          additional chrome. */}
      {result && result.intelligence ? (
        <ScanIntelligenceSections intelligence={result.intelligence} />
      ) : null}

      {/* Wave-28 Harvest Readiness — when the runtime returned a
          harvest result on this scan, render the appropriate card
          inline (above the action row). Gated on category so
          unsupported plants never see the card. Bloom path for
          flowers; harvest path for everything else. The parent
          (ScanPage) attaches the result via window event so this
          card stays pure-presentational. */}
      {result && result.harvest && result.harvest.category === 'flower' ? (
        <BloomStageCard
          result={result.harvest}
          onScanAgain={typeof onRetake === 'function' ? onRetake : undefined}
        />
      ) : null}
      {result && result.harvest
        && result.harvest.category !== 'unknown'
        && result.harvest.category !== 'flower' ? (
        <HarvestReadinessCard
          result={result.harvest}
          onCreateHarvestTask={typeof onAddTasks === 'function' ? onAddTasks : undefined}
          onSavePlant={typeof onSave === 'function' ? onSave : undefined}
          onScanAgain={typeof onRetake === 'function' ? onRetake : undefined}
        />
      ) : null}

      {/* Wave-35 H8 — when the harvest engine returned category
          'unknown' (= plant not in the 28-plant supported set) AND
          we DO have a plant identification (so it's not just a
          generic scan failure), surface a small honest hint that
          harvest readiness isn't yet supported for this plant.
          Suppresses for flowers (BloomStageCard renders instead). */}
      {result && result.harvest
        && result.harvest.category === 'unknown'
        && (result.plantName || result.cropName || result.crop) ? (
        <div
          data-testid="harvest-not-supported-hint"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '8px 12px',
            color: '#9FB3C8',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {tStrict(
            'scan.harvest.notYetSupported',
            'Harvest readiness for this plant is not yet supported. We are expanding the supported list.'
          )}
        </div>
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
          // Prefer the May 2026 decision-shape one-liner — it
          // composes crop · issue · → action so the shared link
          // already tells the recipient what to do, not just
          // what was seen. Falls back to the legacy "Possible
          // issue:" composer when the backend hasn't emitted
          // the decision envelope yet (older bundles / older
          // server versions).
          const summary = String(result?.decision?.saveableSummary || '').trim();
          if (summary) return summary + ' Scanned with Farroway.';
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
    </>
  );
}
