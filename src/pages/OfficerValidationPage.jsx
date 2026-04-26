import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/client.js';
import { getCropLabel, getCropIcon, getCropLabelSafe } from '../utils/crops.js';
import InlineAlert from '../components/InlineAlert.jsx';
import { FarmerAvatarSmall } from '../components/FarmerAvatar.jsx';
import { trackPilotEvent } from '../utils/pilotTracker.js';
// Voice removed — officer routes are admin context per
// src/lib/voice/adminGuard.js. Keeps the officer queue quiet +
// focused. Farmer-facing voice is unaffected.
import { useTranslation } from '../i18n/index.js';

const VALIDATION_TIMEOUT_MS = 10000;

/**
 * OfficerValidationPage — fast-flow validation queue.
 *
 * Design: image-first, swipe-through cards. Officer taps Approve / Reject / Flag
 * and auto-advances to the next item. Under 10 seconds per decision.
 *
 * No confirmation popups. Notes only required for Reject / Flag.
 * Keyboard shortcuts: A = approve, R = reject, F = flag, → = next, ← = prev.
 */

function getStageLabelsOfficer(t) {
  return {
    pre_planting: t('stageLabel.prePlanting'), planting: t('stageLabel.planting'), vegetative: t('stageLabel.vegetative'),
    flowering: t('stageLabel.flowering'), harvest: t('stageLabel.harvest'), post_harvest: t('stageLabel.postHarvest'),
  };
}

const CONDITION_COLORS = { good: '#22C55E', average: '#F59E0B', poor: '#EF4444' };
const PRIORITY_COLORS = { high: '#EF4444', medium: '#F59E0B', normal: '#22C55E' };

export default function OfficerValidationPage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [actionMode, setActionMode] = useState(null); // null | 'reject' | 'flag'
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null); // { type, msg }
  const [completedIds, setCompletedIds] = useState(new Set());
  const submitGuardRef = useRef(false);
  const noteInputRef = useRef(null);
  const startTimeRef = useRef(null);
  const { t, lang } = useTranslation();
  const STAGE_LABELS = getStageLabelsOfficer(t);

  // ─── Load queue ─────────────────────────────────────────

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/seasons/validation-queue', { params: { limit: 100 } });
      setQueue(res.data.queue || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load validation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Track time per item
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentIdx]);

  // ─── Current item ───────────────────────────────────────

  const pendingQueue = queue.filter(item => !completedIds.has(item.seasonId));
  const current = pendingQueue[currentIdx] || null;
  const totalPending = pendingQueue.length;

  // ─── Navigation ─────────────────────────────────────────

  const goNext = useCallback(() => {
    setActionMode(null);
    setNote('');
    setActionFeedback(null);
    // Stay at same index (since current was removed from pending) or wrap
    if (currentIdx >= pendingQueue.length - 1) {
      setCurrentIdx(Math.max(0, pendingQueue.length - 2));
    }
    // Time already resets via useEffect on currentIdx
  }, [currentIdx, pendingQueue.length]);

  const goPrev = useCallback(() => {
    setActionMode(null);
    setNote('');
    setActionFeedback(null);
    setCurrentIdx(i => Math.max(0, i - 1));
  }, []);

  const goNextManual = useCallback(() => {
    setActionMode(null);
    setNote('');
    setActionFeedback(null);
    setCurrentIdx(i => Math.min(pendingQueue.length - 1, i + 1));
  }, [pendingQueue.length]);

  // ─── Actions ────────────────────────────────────────────

  const handleAction = useCallback(async (actionType) => {
    if (!current || submitGuardRef.current) return;

    // For reject/flag, require note
    if ((actionType === 'reject' || actionType === 'flag') && !note.trim()) {
      if (actionMode !== actionType) {
        setActionMode(actionType);
        setTimeout(() => noteInputRef.current?.focus(), 100);
        return;
      }
      // Already in mode but no note — flash warning
      return;
    }

    submitGuardRef.current = true;
    setSubmitting(true);
    setActionFeedback(null);

    const elapsed = Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000);

    try {
      const payload = {
        validationType: actionType === 'approve' ? 'stage' : 'credibility',
        confirmedStage: current.currentStage || null,
        confirmedCondition: current.latestEntry?.condition || null,
        note: actionType === 'approve' ? null : note.trim() || null,
      };

      // Add flag metadata for rejected/flagged
      if (actionType === 'reject') {
        payload.validationType = 'credibility';
        payload.note = `[REJECTED] ${note.trim()}`;
      } else if (actionType === 'flag') {
        payload.validationType = 'credibility';
        payload.note = `[FLAGGED] ${note.trim()}`;
      }

      // Timeout-protected submission
      const submitPromise = api.post(`/seasons/${current.seasonId}/officer-validate`, payload);
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Validation timed out. Tap to retry.')), VALIDATION_TIMEOUT_MS)
      );
      await Promise.race([submitPromise, timeoutPromise]);

      trackPilotEvent('officer_validation', {
        seasonId: current.seasonId,
        action: actionType,
        elapsed,
      });

      // Mark as completed and show feedback
      setCompletedIds(prev => new Set([...prev, current.seasonId]));
      setActionFeedback({
        type: actionType,
        msg: actionType === 'approve' ? 'Approved ✅' : actionType === 'reject' ? 'Rejected' : 'Flagged',
      });

      // Auto-advance after brief feedback
      setTimeout(() => {
        goNext();
      }, 400);

    } catch (err) {
      const isTimeout = err?.message?.includes('timed out');
      setActionFeedback({
        type: 'error',
        msg: isTimeout ? err.message : (err.response?.data?.error || 'Failed — tap to retry'),
      });
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  }, [current, actionMode, note, goNext]);

  // ─── Keyboard shortcuts ─────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (actionMode) return; // Don't hijack while typing note
      if (e.key === 'a' || e.key === 'A') handleAction('approve');
      if (e.key === 'r' || e.key === 'R') handleAction('reject');
      if (e.key === 'f' || e.key === 'F') handleAction('flag');
      if (e.key === 'ArrowRight') goNextManual();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actionMode, handleAction, goNextManual, goPrev]);

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={VS.page}>
        <div style={VS.loadingCenter}>
          <div style={VS.spinner} />
          <div style={{ color: '#A1A1AA', marginTop: '0.75rem' }}>{t('validation.loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={VS.page}>
        <div style={{ padding: '1rem' }}>
          <InlineAlert variant="danger" action={{ label: 'Retry', onClick: loadQueue }}>{error}</InlineAlert>
        </div>
      </div>
    );
  }

  if (totalPending === 0 && queue.length === 0) {
    return (
      <div style={VS.page}>
        {/* Voice bar removed for officer routes — admin context. */}
        <div style={VS.emptyCenter} data-testid="validation-empty">
          <span style={{ fontSize: '3rem' }}>✅</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.5rem' }}>{t('validation.queueClear')}</div>
          <div style={{ color: '#A1A1AA', marginTop: '0.25rem' }}>{t('validation.noUpdatesNow')}</div>
          <button onClick={loadQueue} style={VS.refreshBtn}>{t('validation.refresh')}</button>
        </div>
      </div>
    );
  }

  if (totalPending === 0 && completedIds.size > 0) {
    return (
      <div style={VS.page}>
        {/* Voice bar removed for officer routes — admin context. */}
        <div style={VS.emptyCenter} data-testid="validation-done">
          <span style={{ fontSize: '3rem' }}>🎉</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.5rem' }}>{t('validation.allDone')}</div>
          <div style={{ color: '#A1A1AA', marginTop: '0.25rem' }}>{completedIds.size} {t('validation.updatesValidated')}</div>
          <button onClick={loadQueue} style={VS.refreshBtn}>{t('validation.loadMore')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={VS.page} data-testid="officer-validation-page">
      {/* Header bar — count + progress */}
      <div style={VS.header} data-testid="validation-header">
        <div style={VS.headerLeft}>
          <span style={VS.headerTitle}>{t('validation.validateUpdates')}</span>
          <span style={VS.headerCount}>{completedIds.size} / {queue.length}</span>
        </div>
        <div style={VS.headerRight}>
          <span style={VS.counterBadge}>{totalPending} {t('validation.left')}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={VS.progressBar}>
        <div style={{ ...VS.progressFill, width: `${queue.length > 0 ? (completedIds.size / queue.length) * 100 : 0}%` }} />
      </div>

      {/* Voice guide for officers */}
      <div style={{ padding: '0.5rem 1rem 0', maxWidth: '600px', width: '100%', margin: '0 auto' }}>
        {/* Voice bar removed for officer routes — admin context. */}
      </div>

      {current && (
        <div style={VS.cardWrap}>
          {/* Image area — dominant */}
          <div style={VS.imageSection} data-testid="validation-image">
            {current.latestEntry?.imageUrl || current.recentImages?.[0]?.url ? (
              <img
                src={current.latestEntry?.imageUrl || current.recentImages[0].url}
                alt="Farm update"
                style={VS.mainImage}
                loading="eager"
              />
            ) : (
              <div style={VS.noImage} data-testid="no-image-placeholder">
                <span style={{ fontSize: '2.5rem' }}>📷</span>
                <span style={{ color: '#71717A', fontSize: '0.9rem' }}>{t('validation.noPhoto')}</span>
              </div>
            )}
            {/* Priority badge */}
            <span style={{ ...VS.priorityBadge, background: PRIORITY_COLORS[current.priority] + '20', color: PRIORITY_COLORS[current.priority] }} data-testid="priority-badge">
              {current.priority}
            </span>
            {/* Counter overlay */}
            <span style={VS.counterOverlay}>
              {currentIdx + 1} / {totalPending}
            </span>
          </div>

          {/* Info strip — minimal */}
          <div style={VS.infoStrip} data-testid="validation-info">
            <div style={VS.infoRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {current.farmerImage ? (
                  <FarmerAvatarSmall fullName={current.farmerName} profileImageUrl={current.farmerImage} size={32} />
                ) : (
                  <span style={{ fontSize: '1.5rem' }}>{getCropIcon(current.cropType)}</span>
                )}
                <div>
                  <div style={VS.farmerName}>{current.farmerName}</div>
                  <div style={VS.farmMeta}>
                    {getCropLabelSafe(current.cropType, lang)}
                    {current.currentStage ? ` · ${STAGE_LABELS[current.currentStage] || current.currentStage}` : ''}
                  </div>
                </div>
              </div>
              {current.farmerRegion && (
                <div style={VS.regionBadge}>
                  {current.farmerRegion}{current.farmerDistrict ? `, ${current.farmerDistrict}` : ''}
                </div>
              )}
            </div>

            {/* Latest entry summary */}
            {current.latestEntry && (
              <div style={VS.entrySummary}>
                {current.latestEntry.activityType && (
                  <span style={VS.entryTag}>{current.latestEntry.activityType}</span>
                )}
                {current.latestEntry.condition && (
                  <span style={{ ...VS.conditionTag, color: CONDITION_COLORS[current.latestEntry.condition] || '#A1A1AA' }}>
                    {current.latestEntry.condition}
                  </span>
                )}
                {current.daysSinceEntry != null && (
                  <span style={VS.dateTag}>
                    {current.daysSinceEntry === 0 ? 'today' : current.daysSinceEntry === 1 ? '1d ago' : `${current.daysSinceEntry}d ago`}
                  </span>
                )}
                {current.entryCount > 1 && (
                  <span style={VS.dateTag}>+{current.entryCount - 1} more</span>
                )}
              </div>
            )}
          </div>

          {/* Action feedback overlay */}
          {actionFeedback && (
            <div style={{
              ...VS.feedbackOverlay,
              background: actionFeedback.type === 'approve' ? 'rgba(34,197,94,0.9)'
                : actionFeedback.type === 'error' ? 'rgba(239,68,68,0.9)'
                : 'rgba(245,158,11,0.9)',
            }} data-testid="action-feedback">
              <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{actionFeedback.msg}</span>
            </div>
          )}

          {/* Note input for reject/flag */}
          {actionMode && (
            <div style={VS.noteSection} data-testid="note-input-section">
              <input
                ref={noteInputRef}
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && note.trim()) handleAction(actionMode); }}
                placeholder={actionMode === 'reject' ? t('validation.reasonReject') : t('validation.whyFlag')}
                style={VS.noteInput}
                autoFocus
                data-testid="note-input"
              />
              <button
                onClick={() => handleAction(actionMode)}
                disabled={!note.trim() || submitting}
                style={{
                  ...VS.noteSubmitBtn,
                  opacity: note.trim() ? 1 : 0.5,
                  background: actionMode === 'reject' ? '#EF4444' : '#F59E0B',
                }}
                data-testid="note-submit-btn"
              >
                {submitting ? '...' : actionMode === 'reject' ? t('validation.reject') : t('validation.flag')}
              </button>
              <button onClick={() => { setActionMode(null); setNote(''); }} style={VS.noteCancelBtn}>
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* Action buttons — large, always visible */}
          {!actionMode && (
            <div style={VS.actionBar} data-testid="action-buttons">
              <button
                onClick={() => handleAction('reject')}
                style={VS.rejectBtn}
                disabled={submitting}
                data-testid="reject-btn"
                aria-label={t('validation.reject')}
              >
                <span style={VS.actionBtnIcon}>✗</span>
                <span style={VS.actionBtnLabel}>{t('validation.reject')}</span>
              </button>
              <button
                onClick={() => handleAction('flag')}
                style={VS.flagBtn}
                disabled={submitting}
                data-testid="flag-btn"
                aria-label={t('validation.flag')}
              >
                <span style={VS.actionBtnIcon}>⚑</span>
                <span style={VS.actionBtnLabel}>{t('validation.flag')}</span>
              </button>
              <button
                onClick={() => handleAction('approve')}
                style={VS.approveBtn}
                disabled={submitting}
                data-testid="approve-btn"
                aria-label={t('validation.approve')}
              >
                <span style={VS.actionBtnIcon}>✓</span>
                <span style={VS.actionBtnLabel}>{t('validation.approve')}</span>
              </button>
            </div>
          )}

          {/* Nav arrows */}
          <div style={VS.navBar} data-testid="nav-bar">
            <button onClick={goPrev} disabled={currentIdx === 0} style={VS.navBtn} data-testid="nav-prev">{'← ' + t('validation.prev')}</button>
            <button onClick={goNextManual} disabled={currentIdx >= totalPending - 1} style={VS.navBtn} data-testid="nav-next">{t('validation.next') + ' →'}</button>
          </div>
        </div>
      )}

      {/* Keyboard hint — desktop only */}
      <div style={VS.kbHint} data-testid="keyboard-hints">
        <span>A</span> {t('validation.approve')} &nbsp; <span>R</span> {t('validation.reject')} &nbsp; <span>F</span> {t('validation.flag')} &nbsp; <span>←→</span> Navigate
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const VS = {
  page: {
    minHeight: '100vh', background: '#0F172A', color: '#FFFFFF',
    display: 'flex', flexDirection: 'column',
  },
  loadingCenter: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '40px', height: '40px', border: '4px solid #243041',
    borderTopColor: '#22C55E', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyCenter: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', padding: '2rem',
  },
  refreshBtn: {
    marginTop: '1rem', padding: '0.7rem 2rem', background: '#22C55E', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '48px', WebkitTapHighlightColor: 'transparent',
  },

  // Header
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem', background: '#162033', borderBottom: '1px solid #243041',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  headerTitle: { fontSize: '1.05rem', fontWeight: 700 },
  headerCount: { fontSize: '0.8rem', color: '#A1A1AA' },
  headerRight: { display: 'flex', alignItems: 'center' },
  counterBadge: {
    padding: '0.3rem 0.7rem', background: 'rgba(14,165,233,0.15)',
    color: '#0EA5E9', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600,
  },

  // Progress bar
  progressBar: {
    height: '3px', background: '#243041',
  },
  progressFill: {
    height: '100%', background: '#22C55E', transition: 'width 0.3s ease',
  },

  // Card
  cardWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    maxWidth: '600px', width: '100%', margin: '0 auto',
    position: 'relative',
  },

  // Image
  imageSection: {
    position: 'relative', width: '100%', aspectRatio: '4/3',
    background: '#162033', overflow: 'hidden',
  },
  mainImage: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  noImage: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    background: '#162033',
  },
  priorityBadge: {
    position: 'absolute', top: '0.75rem', left: '0.75rem',
    padding: '0.25rem 0.6rem', borderRadius: '8px',
    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
  },
  counterOverlay: {
    position: 'absolute', top: '0.75rem', right: '0.75rem',
    padding: '0.25rem 0.6rem', background: 'rgba(0,0,0,0.6)',
    borderRadius: '8px', fontSize: '0.75rem', color: '#FFFFFF', fontWeight: 600,
  },

  // Info strip
  infoStrip: {
    padding: '0.75rem 1rem', background: '#162033',
    borderBottom: '1px solid #243041',
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  farmerName: { fontWeight: 700, fontSize: '0.95rem' },
  farmMeta: { fontSize: '0.8rem', color: '#A1A1AA' },
  regionBadge: {
    fontSize: '0.75rem', color: '#71717A', textAlign: 'right',
  },
  entrySummary: {
    display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap',
  },
  entryTag: {
    padding: '0.15rem 0.5rem', background: 'rgba(14,165,233,0.15)',
    color: '#0EA5E9', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
    textTransform: 'capitalize',
  },
  conditionTag: {
    padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'capitalize',
  },
  dateTag: {
    padding: '0.15rem 0.5rem', color: '#71717A', fontSize: '0.75rem',
  },

  // Feedback overlay
  feedbackOverlay: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    padding: '1rem 2rem', borderRadius: '12px', color: '#FFFFFF',
    zIndex: 10, pointerEvents: 'none',
  },

  // Note input
  noteSection: {
    display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
    background: '#1E293B', borderBottom: '1px solid #243041',
    alignItems: 'center',
  },
  noteInput: {
    flex: 1, padding: '0.6rem 0.75rem', background: '#0F172A',
    border: '1px solid #243041', borderRadius: '8px', color: '#FFFFFF',
    fontSize: '0.9rem', outline: 'none', minHeight: '44px',
  },
  noteSubmitBtn: {
    padding: '0.6rem 1rem', color: '#FFFFFF', border: 'none',
    borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '44px', whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  noteCancelBtn: {
    padding: '0.6rem 0.75rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '8px', fontSize: '0.8rem',
    cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },

  // Action buttons
  actionBar: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem',
    padding: '0.75rem 1rem', background: '#0F172A',
  },
  rejectBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.2rem',
    padding: '0.75rem', background: 'rgba(239,68,68,0.12)',
    border: '2px solid rgba(239,68,68,0.3)', borderRadius: '12px',
    color: '#EF4444', cursor: 'pointer', minHeight: '64px',
    WebkitTapHighlightColor: 'transparent',
  },
  flagBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.2rem',
    padding: '0.75rem', background: 'rgba(245,158,11,0.12)',
    border: '2px solid rgba(245,158,11,0.3)', borderRadius: '12px',
    color: '#F59E0B', cursor: 'pointer', minHeight: '64px',
    WebkitTapHighlightColor: 'transparent',
  },
  approveBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.2rem',
    padding: '0.75rem', background: 'rgba(34,197,94,0.12)',
    border: '2px solid rgba(34,197,94,0.3)', borderRadius: '12px',
    color: '#22C55E', cursor: 'pointer', minHeight: '64px',
    WebkitTapHighlightColor: 'transparent',
  },
  actionBtnIcon: { fontSize: '1.5rem', fontWeight: 800 },
  actionBtnLabel: { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' },

  // Nav bar
  navBar: {
    display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem',
    borderTop: '1px solid #243041',
  },
  navBtn: {
    padding: '0.5rem 1.25rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '8px', color: '#A1A1AA', fontSize: '0.85rem', cursor: 'pointer',
    minHeight: '44px', WebkitTapHighlightColor: 'transparent',
  },

  // Keyboard hints
  kbHint: {
    textAlign: 'center', padding: '0.5rem', fontSize: '0.7rem', color: '#3F3F46',
    borderTop: '1px solid #1E293B',
  },
};
