/**
 * CompletionCard — success/completion state after task completion.
 *
 * Structure:
 *   A. Animated checkmark + "Done"
 *   B. Outcome value line (what was achieved)
 *   C. Next step preview (if available)
 *   D. Primary CTA: Continue / Next Task
 *   E. Secondary CTA: Later / Done for now
 *   F. Offline badge (if saved offline)
 *   G. Progress signal
 *   H. Return-habit cue (if no next task)
 *
 * Renders from CompletionState model only. No raw task access.
 * Mobile-first, low-friction, rewarding.
 */
import { useEffect, useRef } from 'react';
import { safeTrackEvent } from '../../lib/analytics.js';

export default function CompletionCard({
  completionState,
  t,
  onContinue,
  onLater,
  onFollowUp,
  onUndo,           // spec §1 — short-window undo
  onReportIssue,    // spec §3 — Something is wrong
  canUndo,          // true while the undo window is open
  variant,
}) {
  const cs = completionState;
  const trackedRef = useRef(false);

  // Track completion state shown (once)
  useEffect(() => {
    if (!cs || trackedRef.current) return;
    trackedRef.current = true;
    safeTrackEvent('completion_state_shown', {
      taskId: cs.completedTaskId,
      taskType: cs.completedTaskType,
      hasNext: cs.hasNext,
      savedOffline: cs.savedOffline,
      isDoneForNow: cs.isDoneForNow,
    });
    if (cs.hasNext) {
      safeTrackEvent('next_task_shown', {
        nextTaskType: cs.nextTaskType,
      });
    }
  }, [cs]);

  // Haptic on mount
  useEffect(() => {
    if (navigator.vibrate) {
      try { navigator.vibrate(cs?.savedOffline ? [30, 30, 30] : 50); } catch {}
    }
  }, []);

  if (!cs) return null;

  const isSimple = variant === 'simple';
  const outcomeText = t(cs.successOutcomeKey);
  const progressText = cs.progressSignalKey
    ? t(cs.progressSignalKey, { count: cs.remainingCount, done: cs.completedCount })
    : null;

  function handleContinue() {
    safeTrackEvent('continue_clicked', {
      taskId: cs.completedTaskId,
      hasNext: cs.hasNext,
    });
    onContinue?.();
  }

  function handleLater() {
    safeTrackEvent('later_clicked', {
      taskId: cs.completedTaskId,
      isDoneForNow: cs.isDoneForNow,
    });
    onLater?.();
  }

  // ─── SIMPLE VARIANT (BasicFarmerHome) ─────────────────────
  if (isSimple) {
    return (
      <div style={S.simpleCard} data-testid="completion-card">
        {/* A. Success check */}
        <div style={S.checkWrap}>
          <div style={S.checkCircle}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={S.checkSvg}>
              <path
                d="M9 16.5L14 21.5L23 11.5"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={S.checkPath}
              />
            </svg>
          </div>
        </div>

        {/* A. Title */}
        <div style={S.simpleTitle}>{t(cs.successTitleKey)}</div>

        {/* B. Outcome value line */}
        <div style={S.outcomeText}>{outcomeText}</div>

        {/* F. Offline badge */}
        {cs.savedOffline && (
          <div style={S.offlineBadge}>
            <span style={S.offlineDot} />
            {t('loop.savedOffline')}
          </div>
        )}

        {/* G. Progress signal */}
        {progressText && (
          <div style={S.progressChip}>{progressText}</div>
        )}

        {/* Follow-up question (spec §4) */}
        {cs.followUp && (
          <div style={S.followUpWrap} data-testid="follow-up-question">
            <div style={S.followUpQuestion}>{t(cs.followUp.questionKey)}</div>
            <div style={S.followUpOptions}>
              {cs.followUp.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    safeTrackEvent('followup_answered', { value: opt.value, type: cs.followUp.type });
                    onFollowUp?.({ value: opt.value, status: opt.status });
                  }}
                  style={S.followUpBtn}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* C. Next step preview */}
        {cs.hasNext && cs.nextTaskTitle && (
          <div style={S.nextPreview}>
            <span style={S.nextLabel}>{t('completion.nextStep')}</span>
            <span style={S.nextTitle}>{cs.nextTaskTitle}</span>
          </div>
        )}

        {/* H. Return-habit cue */}
        {cs.isDoneForNow && cs.returnCueKey && (
          <div style={S.returnCue}>{t(cs.returnCueKey)}</div>
        )}

        {/* D. Primary CTA */}
        <button
          type="button"
          onClick={handleContinue}
          style={S.primaryBtn}
          data-testid="completion-continue"
        >
          {cs.hasNext ? t('completion.continue') : t('completion.backToHome')}
        </button>

        {/* E. Secondary CTA */}
        {cs.hasNext && (
          <button
            type="button"
            onClick={handleLater}
            style={S.secondaryBtn}
            data-testid="completion-later"
          >
            {t('completion.later')}
          </button>
        )}

        {/* F. Correction row (spec §1 + §3) */}
        <CorrectionRow
          t={t}
          canUndo={canUndo}
          onUndo={onUndo}
          onReportIssue={onReportIssue}
        />
      </div>
    );
  }

  // ─── STANDARD VARIANT (NextActionCard) ────────────────────
  return (
    <div style={S.standardCard} data-testid="completion-card">
      <div style={S.standardRow}>
        {/* A. Success check */}
        <div style={S.checkCircleSmall}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <path
              d="M9 16.5L14 21.5L23 11.5"
              stroke="#22C55E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={S.checkPath}
            />
          </svg>
        </div>

        <div style={S.standardContent}>
          {/* A. Title */}
          <div style={S.standardTitle}>{t(cs.successTitleKey)}</div>
          {/* B. Outcome */}
          <div style={S.standardOutcome}>{outcomeText}</div>
        </div>
      </div>

      {/* F. Offline badge */}
      {cs.savedOffline && (
        <div style={S.offlineBadgeCompact}>
          <span style={S.offlineDot} />
          {t('loop.savedOffline')}
        </div>
      )}

      {/* G. Progress */}
      {progressText && (
        <div style={S.progressChipCompact}>{progressText}</div>
      )}

      {/* Follow-up question (spec §4) */}
      {cs.followUp && (
        <div style={S.followUpWrap} data-testid="follow-up-question">
          <div style={S.followUpQuestion}>{t(cs.followUp.questionKey)}</div>
          <div style={S.followUpOptions}>
            {cs.followUp.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  safeTrackEvent('followup_answered', { value: opt.value, type: cs.followUp.type });
                  onFollowUp?.({ value: opt.value, status: opt.status });
                }}
                style={S.followUpBtn}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* C. Next step preview */}
      {cs.hasNext && cs.nextTaskTitle && (
        <div style={S.nextPreviewCompact}>
          <span style={S.nextLabelCompact}>{t('completion.nextStep')}</span>
          <span style={S.nextTitleCompact}>{cs.nextTaskTitle}</span>
        </div>
      )}

      {/* H. Return-habit cue */}
      {cs.isDoneForNow && cs.returnCueKey && (
        <div style={S.returnCueCompact}>{t(cs.returnCueKey)}</div>
      )}

      {/* D + E. CTAs */}
      <div style={S.ctaRow}>
        <button
          type="button"
          onClick={handleContinue}
          style={S.primaryBtnCompact}
          data-testid="completion-continue"
        >
          {cs.hasNext ? t('completion.continue') : t('completion.backToHome')}
        </button>
        {cs.hasNext && (
          <button
            type="button"
            onClick={handleLater}
            style={S.secondaryBtnCompact}
            data-testid="completion-later"
          >
            {t('completion.later')}
          </button>
        )}
      </div>
      <CorrectionRow
        t={t}
        canUndo={canUndo}
        onUndo={onUndo}
        onReportIssue={onReportIssue}
      />
    </div>
  );
}

// ─── Correction row (spec §1 + §3 + §10) ───────────────────
// Undo is primary short-term; Something is wrong is secondary.
// Both are muted, never competing with the main Continue/Later CTAs.
function CorrectionRow({ t, canUndo, onUndo, onReportIssue }) {
  const showUndo = canUndo && typeof onUndo === 'function';
  const showReport = typeof onReportIssue === 'function';
  if (!showUndo && !showReport) return null;

  return (
    <div style={CR.row} data-testid="correction-row">
      {showUndo && (
        <button type="button" onClick={onUndo} style={CR.undoBtn} data-testid="completion-undo">
          {t('correction.undo')}
        </button>
      )}
      {showReport && (
        <button type="button" onClick={onReportIssue} style={CR.reportBtn} data-testid="completion-report-issue">
          {t('correction.somethingWrong')}
        </button>
      )}
    </div>
  );
}

const CR = {
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '0.5rem',
  },
  undoBtn: {
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  reportBtn: {
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    border: '1px dashed rgba(255,255,255,0.08)',
    background: 'transparent',
    color: '#6F8299',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};

// ─── Styles ─────────────────────────────────────────────────
const S = {
  // ═══ Simple variant ═══
  simpleCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '2rem 1.5rem',
    borderRadius: '22px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.14)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    textAlign: 'center',
    animation: 'farroway-scale-in 0.35s ease-out',
  },
  checkWrap: {
    marginBottom: '0.25rem',
  },
  checkCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    border: '2px solid rgba(34,197,94,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'farroway-scale-in 0.4s ease-out',
  },
  checkSvg: {
    display: 'block',
  },
  checkPath: {
    strokeDasharray: 30,
    strokeDashoffset: 30,
    animation: 'completion-check-draw 0.5s ease-out 0.2s forwards',
  },
  simpleTitle: {
    fontSize: '1.375rem',
    fontWeight: 800,
    color: '#EAF2FF',
  },
  outcomeText: {
    fontSize: '0.9375rem',
    color: '#9FB3C8',
    fontWeight: 500,
    lineHeight: 1.4,
    maxWidth: '20rem',
  },
  offlineBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.14)',
    fontSize: '0.75rem',
    color: '#F59E0B',
    fontWeight: 600,
  },
  offlineDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#F59E0B',
    flexShrink: 0,
  },
  progressChip: {
    fontSize: '0.8125rem',
    color: '#22C55E',
    fontWeight: 700,
  },
  nextPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    width: '100%',
  },
  nextLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  nextTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  returnCue: {
    fontSize: '0.875rem',
    color: '#6F8299',
    fontWeight: 500,
    lineHeight: 1.4,
    maxWidth: '20rem',
  },
  primaryBtn: {
    width: '100%',
    padding: '0.9375rem 1rem',
    borderRadius: '16px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '1.0625rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '52px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    marginTop: '0.375rem',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtn: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'transparent',
    color: '#6F8299',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },

  // ═══ Follow-up (spec §4) ═══
  followUpWrap: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  followUpQuestion: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#EAF2FF',
    marginBottom: '0.5rem',
    textAlign: 'center',
  },
  followUpOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
    justifyContent: 'center',
  },
  followUpBtn: {
    padding: '0.375rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#9FB3C8',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '36px',
    WebkitTapHighlightColor: 'transparent',
  },

  // ═══ Standard variant ═══
  standardCard: {
    borderRadius: '20px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.14)',
    padding: '1.25rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-scale-in 0.35s ease-out',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  standardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  checkCircleSmall: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    border: '2px solid rgba(34,197,94,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    animation: 'farroway-scale-in 0.4s ease-out',
  },
  standardContent: {
    flex: 1,
    minWidth: 0,
  },
  standardTitle: {
    fontSize: '1.0625rem',
    fontWeight: 800,
    color: '#EAF2FF',
  },
  standardOutcome: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 500,
    marginTop: '0.125rem',
    lineHeight: 1.4,
  },
  offlineBadgeCompact: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.14)',
    fontSize: '0.6875rem',
    color: '#F59E0B',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  progressChipCompact: {
    fontSize: '0.75rem',
    color: '#22C55E',
    fontWeight: 700,
  },
  nextPreviewCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  nextLabelCompact: {
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  nextTitleCompact: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  returnCueCompact: {
    fontSize: '0.8125rem',
    color: '#6F8299',
    fontWeight: 500,
  },
  ctaRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  primaryBtnCompact: {
    flex: 1,
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '48px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtnCompact: {
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: 'transparent',
    color: '#6F8299',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
    whiteSpace: 'nowrap',
  },
};
