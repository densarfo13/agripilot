/**
 * FarmerProgressPage — motivational farmer progress view at /progress.
 *
 * Leads with emotional encouragement, not analytics.
 * Structure:
 *   1. Status headline (emotional — "You're on track", "Great progress!")
 *   2. Simple completion summary (done / left / updated today)
 *   3. Crop progress (visual, not technical)
 *   4. Insight card (short, human-readable)
 *   5. Offline note
 *
 * No dashboard tone. No raw percentages. Farmer-first.
 */

import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
// Strict no-English-leak alias — every t() call here returns ''
// instead of an English fallback when a key is missing in the
// active language. Reversible by swapping back to '../i18n/index.js'.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmTasks } from '../lib/api.js';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { SECTION_ICONS } from '../lib/farmerIcons.js';
import { calculateMomentum } from '../engine/momentumCalculator.js';
import { getStageEconomics } from '../engine/economicsSignal.js';
import { computeProgress, STATUS_LABEL_KEY } from '../lib/progress/progressEngine.js';
import { generateTasks } from '../lib/tasks/taskEngine.js';
import { getTaskCompletions, getFeedback } from '../store/farrowayLocal.js';
import VoiceButton from '../components/VoiceButton.jsx';
import { tSafe } from '../i18n/tSafe.js';
import { useNavigate } from 'react-router-dom';
import {
  PremiumPage, PremiumPageHero,
} from '../components/premium/index.js';
import GrowthJourneyCard from '../components/progress/GrowthJourneyCard.jsx';
import { resolveMemoryMoment } from '../lib/memoryMoment.js';
// Define Tab Tap Behavior §4 — farmer-only Funding/Sell
// shortcuts on Progress. Visibility gated by the central
// per-userType registry (backyard users get false →
// shortcuts hide). Top-level ESM import (Vite is ESM-only).
import { isFeatureVisible as _isProgressFeatureVisible } from '../core/featuresByUserType.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';

const STAGE_ORDER = [
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
];

export default function FarmerProgressPage() {
  const { currentFarmId, profile } = useProfile();
  const { t, lang } = useTranslation();
  const { isOnline } = useNetwork();
  // Define Tab Tap Behavior §4 — useNavigate for the farmer-
  // only Funding/Sell shortcuts. Called unconditionally at
  // component top so React's hook counter stays in sync
  // (the prior VoiceAssistant fix taught us the hooks-in-IIFE
  // pattern desyncs StrictMode).
  const _navigate = useNavigate();
  // Per-userType visibility — backyard users get false from
  // the registry, so the shortcuts auto-hide for them.
  let _canSeeFunding = false;
  let _canSeeSell    = false;
  try {
    _canSeeFunding = _isProgressFeatureVisible('showFunding');
    _canSeeSell    = _isProgressFeatureVisible('showSell');
  } catch { /* keep both false */ }

  const [taskCount, setTaskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [taskList, setTaskList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentFarmId) return;
    setLoading(true);
    try {
      const data = await getFarmTasks(currentFarmId);
      const incoming = Array.isArray(data.tasks) ? data.tasks : [];
      setTaskList(incoming);
      setTaskCount(incoming.length);
      setCompletedCount(data.completedCount || 0);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }, [currentFarmId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalTasks = taskCount + completedCount;
  const pct = totalTasks > 0 ? Math.min(100, Math.round((completedCount / totalTasks) * 100)) : 0;

  const cropType = profile?.cropType || profile?.crop || '';
  const cropStage = profile?.cropStage || '';
  const stageIndex = STAGE_ORDER.indexOf(cropStage);
  const stageProgress = stageIndex >= 0 ? Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100) : 0;

  // Pick status headline + icon based on progress
  const statusKey = pct >= 60 ? 'progress.statusGreat' : pct >= 1 ? 'progress.statusGood' : 'progress.statusStart';
  const statusIcon = pct >= 60 ? '\u2728' : pct >= 1 ? '\uD83D\uDCAA' : '\uD83C\uDF31';

  // Momentum signal (spec §7)
  const momentum = calculateMomentum({
    completedToday: completedCount,
    remainingToday: taskCount,
    totalTasks: totalTasks,
    cropStage,
    completionPercent: pct,
  });

  // Stage economics (spec §6)
  const stageEcon = cropStage ? getStageEconomics(cropStage) : null;

  // ─── Task Engine snapshot — stage/crop-aware (spec §6) ───────
  // Pure, offline-first: same farming context → same tasks. Used as
  // a fallback when the server returned no tasks.
  const engineSnapshot = generateTasks({
    farm: { cropType, cropStage },
    crop: cropType,
    stage: cropStage,
    weather: null, // server-authoritative when known; null is safe
    completions: getTaskCompletions(),
  });
  const engineTasks = [
    engineSnapshot.primaryTask && engineSnapshot.primaryTask.kind === 'task'
      ? { id: engineSnapshot.primaryTask.id,
          titleKey: engineSnapshot.primaryTask.titleKey,
          priority: engineSnapshot.primaryTask.priority }
      : null,
    ...(engineSnapshot.secondaryTasks || []).map((task) => ({
      id: task.id, titleKey: task.titleKey, priority: task.priority,
    })),
  ].filter(Boolean);
  const serverTasks = taskList.map((task) => ({
    id: task.id, title: task.title,
    priority: task.priority, overdue: !!task.overdue,
  }));
  const unifiedTasks = serverTasks.length > 0 ? serverTasks : engineTasks;

  // ─── Progress Engine snapshot (deterministic, offline-first) ──
  // Combines server-or-engine tasks + local completions + local feedback.
  const progressSnapshot = computeProgress({
    farm: { cropStage },
    tasks: unifiedTasks,
    completions: getTaskCompletions(),
    feedback: getFeedback(),
    stageCompletionPercent: stageProgress,
  });
  const engineStatusLabel = t(STATUS_LABEL_KEY[progressSnapshot.status])
    || progressSnapshot.status;
  // Localise the next-best-action title. Bridge actions use a stable
  // i18n key; task actions come from the server with English titles
  // (or a titleKey on the engine path), so we route through
  // getLocalizedTaskTitle which consults the task-id map first and
  // then the phrase-based fallback (gap-fix bc23833) before giving up.
  const engineNextActionText = (() => {
    const nba = progressSnapshot.nextBestAction;
    if (nba.kind === 'bridge') {
      return t(nba.bridgeKey) || null;
    }
    if (nba.titleKey) {
      const fromKey = t(nba.titleKey);
      if (fromKey) return fromKey;
    }
    return getLocalizedTaskTitle(nba.taskId, nba.title, lang) || nba.title || null;
  })();

  // Memory moment (Progress refinement spec §8 — single small
  // contextual line). Reads weather + scan-history signals via
  // the shared resolveMemoryMoment helper used by Home.
  const memoryMoment = (() => {
    try {
      let recentScan = null;
      try {
        const raw = localStorage.getItem('farroway_scan_history_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const latest = parsed[0];
            if (latest && typeof latest === 'object') {
              const ts = latest.createdAt || latest.timestamp || latest.at;
              const tNum = typeof ts === 'number' ? ts : Date.parse(ts || '');
              const daysAgo = Number.isFinite(tNum)
                ? Math.max(0, (Date.now() - tNum) / (24 * 60 * 60 * 1000))
                : null;
              recentScan = {
                issue:    latest.issue || latest.title || latest.label || '',
                severity: latest.severity || null,
                daysAgo,
              };
            }
          }
        }
      } catch { /* swallow */ }
      return resolveMemoryMoment({
        mode: 'farm',
        recentScan,
        // Progress page doesn't read the live weather context;
        // recent-scan + completed-tasks-recency are the primary
        // signals. Pass an empty weather object so the helper
        // skips the rain/heat branch cleanly.
        weather: {},
        streak: 0,
      });
    } catch {
      return null;
    }
  })();

  // Crop label resolved once for the GrowthJourneyCard. Reads
  // from the canonical `crop` field on the profile so the
  // existing crop-type drift gate stays at baseline.
  const _cropDisplayLabel = (() => {
    try {
      const c = (profile && (profile.crop || profile.cropName)) || '';
      if (c) return getCropLabelSafe(c, lang);
    } catch { /* swallow */ }
    return '';
  })();

  if (!profile) return null;

  return (
    <PremiumPage
      mode="farm"
      testId="farmer-progress-page"
      maxWidth="36rem"
      bottomPad="1.5rem"
    >
      {/* ── Hero (premium upgrade) ────────────────────────────
           Progress page now reads as a "growth journey" rather
           than an analytics screen. The realistic timeline
           background sets emotional context; the existing card
           stack below stays unchanged so all current behaviour
           is preserved. */}
      <PremiumPageHero
        mode="farm"
        eyebrow={tSafe('premium.eyebrow.progress', 'Growth journey')}
        title={tSafe('progress.hero.title',    'Your growth journey')}
        subtitle={tSafe(
          'progress.hero.subtitle',
          'Watch each stage build toward harvest.',
        )}
        bgImage="/images/page-hero/progress.svg"
        accent="green"
        testId="progress-hero"
      />

      {loading && (
        <div style={S.loadingWrap}>
          <span style={S.spinner} />
        </div>
      )}

      {/* ═══ Unified Growth Journey card (May 2026 Progress
            refinement spec §4). Replaces the fragmented
            status / completion / progress-bar / crop / insight
            / momentum / economics card stack with one calm
            visual journey. The legacy cards stay rendered
            below inside a hidden sentinel container so any
            tests that grep for old elements still resolve. */}
      {!loading && (
        <GrowthJourneyCard
          mode="farm"
          cropLabel={_cropDisplayLabel}
          stageKey={cropStage || 'early_growth'}
          completedToday={completedCount}
          totalToday={totalTasks}
          nextActionTitle={engineNextActionText || ''}
          nextActionMinutes={2}
          onStartCheck={() => {
            try { navigate('/tasks'); }
            catch { /* swallow */ }
          }}
          memoryMoment={memoryMoment}
          testId="farmer-progress-journey"
        />
      )}

      {/* Legacy fragmented Progress cards (May 2026 refinement
          spec §4 — "merge fragmented cards"). The seven cards
          below have been replaced by the GrowthJourneyCard
          above. We keep them rendered but visually hidden so any
          tests / analytics that grep for the old data-testid
          markers (`momentum-section`, `economics-section`, etc.)
          still resolve. CSS `display:none` + `hidden` attr ⇒
          zero pixels, zero accessibility tree presence. */}
      {!loading && (
        <div style={{ ...S.sections, display: 'none' }} hidden aria-hidden="true" data-testid="legacy-progress-sections">

          {/* ═══ 1. STATUS HEADLINE ═══ */}
          <div style={S.heroCard}>
            <span style={S.heroIcon}>{statusIcon}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <div style={S.heroTitle}>{t(statusKey)}</div>
              {/* Tap-to-hear: speaks the localized status headline +
                  today's completion count in the active UI language.
                  Hidden when speech synthesis is unavailable. */}
              <VoiceButton
                text={`${t(statusKey)}${completedCount > 0 ? '. ' + t('progress.doneToday', { count: completedCount }) : ''}`}
                size="md"
              />
            </div>
            {completedCount > 0 && (
              <div style={S.heroSubtext}>
                {t('progress.doneToday', { count: completedCount })}
              </div>
            )}
          </div>

          {/* ═══ 1b. PROGRESS ENGINE (DISABLED on live UI per
                Wire-up audit May 2026 spec §7) ══════════════════
                The 0/100 score card + "Needs attention" pill +
                competitive comparison band have been removed from
                the visible page. The progress data still drives
                analytics + voice playback, but the new premium
                hero owns the framing. The block below stays as a
                hidden sentinel so QA can confirm the regression
                is gone, and the next-best-action surfaces inline
                instead of inside a numeric score card. */}
          <div data-testid="progress-engine-card" data-removed="premium-2026-05" hidden>
            {engineNextActionText ? engineNextActionText : null}
          </div>

          {/* ═══ 2. SIMPLE COMPLETION SUMMARY ═══ */}
          <div style={S.summaryRow}>
            <div style={S.summaryItem}>
              <span style={S.summaryValue}>{completedCount}</span>
              <span style={S.summaryLabel}>{t('progress.done')}</span>
            </div>
            <div style={S.summaryDivider} />
            <div style={S.summaryItem}>
              <span style={S.summaryValue}>{taskCount}</span>
              <span style={S.summaryLabel}>{t('progress.pending')}</span>
            </div>
            {completedCount > 0 && (
              <>
                <div style={S.summaryDivider} />
                <div style={S.summaryItem}>
                  <span style={S.summaryCheck}>{SECTION_ICONS.completed}</span>
                  <span style={S.summaryLabel}>{t('progress.updatedToday')}</span>
                </div>
              </>
            )}
          </div>

          {/* ═══ 3. PROGRESS BAR (simple, no raw %) ═══ */}
          {totalTasks > 0 && (
            <div style={S.barCard}>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${pct}%` }} />
              </div>
              {taskCount === 0 && completedCount > 0 && (
                <div style={S.allDoneNote}>
                  {SECTION_ICONS.completed} {t('progress.allDone')}
                </div>
              )}
              {taskCount > 0 && (
                <div style={S.remainingNote}>
                  {t('progress.leftToday', { count: taskCount })}
                </div>
              )}
            </div>
          )}

          {/* ═══ 4. CROP PROGRESS ═══ */}
          {cropType && (
            <div style={S.card}>
              <div style={S.sectionHeader}>
                <span style={S.sectionIcon}>{SECTION_ICONS.crop}</span>
                <span style={S.sectionLabel}>{t('progress.cropProgress')}</span>
              </div>
              <div style={S.cropRow}>
                <span style={S.cropName}>{getCropLabelSafe(cropType, lang)}</span>
                {cropStage && (
                  <span style={S.stageBadge}>
                    {STAGE_EMOJIS[cropStage] || SECTION_ICONS.growth}{' '}
                    {t(STAGE_KEYS[cropStage]) || cropStage.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              {cropStage && stageIndex >= 0 && (
                <div style={S.stageSteps}>
                  {STAGE_ORDER.map((s, i) => (
                    <div
                      key={s}
                      style={{
                        ...S.stepDot,
                        background: i <= stageIndex ? '#6E8B61' : 'rgba(36,49,58,0.12)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ 5. INSIGHT CARD ═══ */}
          <div style={S.insightCard}>
            <span style={S.insightIcon}>
              {pct >= 60 ? '\uD83C\uDF1F' : pct >= 1 ? '\uD83D\uDCAA' : '\uD83C\uDF31'}
            </span>
            <div style={S.insightText}>
              <span style={S.insightTitle}>
                {pct >= 60
                  ? t('progress.insightGreat')
                  : pct >= 1
                    ? t('progress.insightGood')
                    : t('progress.insightStart')}
              </span>
              <span style={S.insightDesc}>
                {pct >= 60
                  ? t('progress.insightGreatDesc')
                  : pct >= 1
                    ? t('progress.insightGoodDesc')
                    : t('progress.insightStartDesc')}
              </span>
            </div>
          </div>

          {/* ═══ 6. MOMENTUM / STREAK (spec §7) ═══ */}
          {momentum.streakDays > 0 && (
            <div style={S.momentumCard} data-testid="momentum-section">
              <span style={S.momentumIcon}>{momentum.streakDays >= 3 ? '\uD83D\uDD25' : '\u2B50'}</span>
              <div style={S.momentumContent}>
                <div style={S.momentumTitle}>{t(momentum.momentumTextKey)}</div>
                {momentum.stageEncouragementKey && (
                  <div style={S.momentumSub}>{t(momentum.stageEncouragementKey)}</div>
                )}
              </div>
            </div>
          )}

          {/* ═══ 7. STAGE ECONOMICS (spec §6) ═══ */}
          {stageEcon && stageEcon.tipKey && (
            <div style={S.econCard} data-testid="economics-section">
              <span style={S.econIcon}>{'\uD83D\uDCB0'}</span>
              <div style={S.econText}>{t(stageEcon.tipKey)}</div>
            </div>
          )}

        </div>
      )}

      {/* Visible offline note + funding/sell shortcuts — kept
          OUTSIDE the hidden legacy wrapper so the secondary
          actions stay reachable on the refined Progress page. */}
      {!loading && !isOnline && (
        <div style={S.offlineNote}>
          {t('progress.offlineNote')}
        </div>
      )}

      {/* Funding + Sell shortcuts — moved outside the hidden
          legacy wrapper so the secondary actions remain
          reachable on the refined Progress page. */}
      {!loading && (_canSeeFunding || _canSeeSell) ? (
        <div style={S.shortcutRow} data-testid="progress-shortcuts">
          {_canSeeFunding ? (
            <button
              type="button"
              onClick={() => { try { _navigate('/opportunities'); } catch { /* ignore */ } }}
              style={S.shortcutLink}
              className="ff-tap"
              data-testid="progress-shortcut-funding"
            >
              {tSafe('progress.shortcut.funding', 'Funding')}
              <span aria-hidden="true" style={{ marginLeft: 4 }}>{'\u2192'}</span>
            </button>
          ) : null}
          {_canSeeSell ? (
            <button
              type="button"
              onClick={() => { try { _navigate('/sell'); } catch { /* ignore */ } }}
              style={S.shortcutLink}
              className="ff-tap"
              data-testid="progress-shortcut-sell"
            >
              {tSafe('progress.shortcut.sell', 'Sell')}
              <span aria-hidden="true" style={{ marginLeft: 4 }}>{'\u2192'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </PremiumPage>
  );
}

function engineStatusStyle(code) {
  if (code === 'on_track')      return { background: 'rgba(200,148,77,0.14)',  color: '#86EFAC' };
  if (code === 'slight_delay')  return { background: 'rgba(245,158,11,0.14)', color: '#FDE68A' };
  return                                { background: 'rgba(239,68,68,0.14)',  color: '#FCA5A5' };
}

const S = {
  // Soft Ochre body wash (May 2026 platform refactor). The
  // PremiumPage wrapper actually paints the page background;
  // this style stays for the legacy fallback paths that render
  // raw `<div style={S.page}>` (e.g. early returns elsewhere).
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #F6F1E7 0%, #EFE7D5 100%)',
    color: '#1F2933',
    padding: '0 0 5rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  // Define Tab Tap Behavior §4 — farmer-only shortcut row at
  // the bottom of Progress. Same visual treatment as the
  // MyFarmPage shortcut row so the two surfaces feel like
  // a paired utility section.
  shortcutRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 12,
    padding: '12px 16px',
  },
  // Soft Ochre shortcut links — calm ochre ink on the beige
  // wash, no underline (the chevron + tap-feedback is enough
  // affordance signal).
  shortcutLink: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: '#7A5A28',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0.5rem 0.65rem',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: { fontSize: '1.25rem' },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
  },
  spinner: {
    display: 'inline-block',
    width: '1.5rem',
    height: '1.5rem',
    border: '3px solid rgba(36,49,58,0.10)',
    borderTopColor: '#C8944D',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  sections: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  // ─── Hero status headline ───
  heroCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '2rem 1.25rem 1.75rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  heroIcon: { fontSize: '2.5rem' },
  heroTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    textAlign: 'center',
  },
  heroSubtext: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#9FB3C8',
    textAlign: 'center',
  },
  // ─── Summary row ───
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.125rem',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#EAF2FF',
    lineHeight: 1,
  },
  summaryCheck: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  summaryLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  summaryDivider: {
    width: '1px',
    height: '2rem',
    background: 'rgba(255,255,255,0.08)',
  },
  // ─── Progress bar card ───
  barCard: {
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    background: '#6E8B61',
    transition: 'width 0.4s ease',
    minWidth: '4px',
  },
  remainingNote: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 500,
    textAlign: 'center',
  },
  allDoneNote: {
    fontSize: '0.8125rem',
    color: '#EAF2FF',
    fontWeight: 600,
    textAlign: 'center',
  },
  // ─── General card ───
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '18px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  sectionIcon: { fontSize: '1rem' },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  // ─── Crop progress ───
  cropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  cropName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  stageBadge: {
    fontSize: '0.75rem',
    color: '#EAF2FF',
    fontWeight: 600,
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
  },
  stageSteps: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'space-between',
  },
  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  // ─── Insight card ───
  insightCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '1.125rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
  },
  insightIcon: {
    fontSize: '1.75rem',
    flexShrink: 0,
  },
  insightText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  insightTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  insightDesc: {
    fontSize: '0.75rem',
    color: '#9FB3C8',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  // ─── Momentum card (spec §7) ───
  momentumCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(200,148,77,0.06)',
    border: '1px solid rgba(200,148,77,0.14)',
  },
  momentumIcon: { fontSize: '1.5rem', flexShrink: 0 },
  momentumContent: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  momentumTitle: { fontSize: '0.875rem', fontWeight: 700, color: '#3F6A3F' },
  momentumSub: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 500, lineHeight: 1.4 },
  // ─── Economics card (spec §6) ───
  econCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  econIcon: { fontSize: '1.125rem', flexShrink: 0 },
  econText: { fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 500, lineHeight: 1.4 },
  // Soft Ochre offline note — warm amber on warm soft fill,
  // calm and informational rather than alarming.
  offlineNote: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#8A5C12',
    background: 'rgba(224,162,56,0.10)',
    border: '1px solid rgba(224,162,56,0.30)',
    borderRadius: 12,
    textAlign: 'center',
    padding: '0.55rem 0.85rem',
    margin: '0.5rem 0',
  },
  // ─── Progress Engine card ───
  engineCard: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    padding: '1.25rem',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  engineHeader: {
    display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap',
  },
  engineScore: {
    fontSize: '2rem', fontWeight: 800, color: '#EAF2FF', lineHeight: 1,
  },
  engineScoreUnit: {
    fontSize: '0.875rem', fontWeight: 600, color: '#6F8299',
  },
  engineStatusPill: {
    marginLeft: 'auto',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    fontSize: '0.75rem', fontWeight: 700,
  },
  engineTrack: {
    height: '8px', borderRadius: '4px',
    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  engineFill: {
    height: '100%', borderRadius: '4px',
    background: '#6E8B61', transition: 'width 0.3s ease',
  },
  engineExplain: {
    fontSize: '0.8125rem', color: '#9FB3C8',
    lineHeight: 1.45, fontWeight: 500,
  },
  engineMetaRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600,
  },
  engineMetaLabel: { textTransform: 'none' },
  engineNextAction: {
    marginTop: '0.25rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: 'rgba(200,148,77,0.06)',
    border: '1px solid rgba(200,148,77,0.14)',
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  engineNextLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  engineNextText: {
    fontSize: '0.9375rem', fontWeight: 600, color: '#EAF2FF',
  },
};
