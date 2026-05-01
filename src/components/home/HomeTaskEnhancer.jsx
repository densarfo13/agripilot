/**
 * HomeTaskEnhancer — hero-first "Today's Priority" surface for
 * the lifecycle recommendations on the farmer Home tab.
 *
 * Spec coverage (Home task action-driven design)
 *   §1 section header "Today's Priority" (rendered by parent)
 *   §2 hero row: title + benefit + urgency
 *   §3 primary action — "Mark as done"
 *   §4 secondary action — "Skip for now"
 *   §5 audio button labelled "Listen in your language"
 *   §6 motivating progress message
 *   §7 success message + progress update on completion
 *
 * Position
 *   Mounts in `FarmerOverviewTab` under the "Today's Priority"
 *   header when `homeTaskV2` is on. Replaces the bare bulleted
 *   list with a hero card for the first non-completed
 *   recommendation, plus optional smaller rows below.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Reuses the existing voice stack (`playVoice` / `stopVoice`).
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { trackFirstAction } from '../../analytics/funnelEvents.js';
import { playVoice, stopVoice } from '../../utils/voicePlayer.js';
import { isFeatureEnabled } from '../../config/features.js';
import { getStreak } from '../../utils/streak.js';
import {
  taskKeyFor,
  markHomeTask,
  getHomeTaskStateMap,
  HOME_TASK_STATE_CHANGED_EVENT,
} from './homeTaskState.js';

const TONES = {
  today:    { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' },
  thisWeek: { color: '#7DD3FC', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.32)' },
};

// Heuristic urgency keyed off recommendation text. Same lists as
// the multi-row variant so the "today / this week" classification
// stays consistent between the hero and the smaller rows.
const TODAY_KEYWORDS = ['water', 'irrigate', 'urgent', 'today', 'spray', 'check leaves'];
const WEEK_KEYWORDS  = ['plant', 'harvest', 'fertilise', 'fertilize', 'weed', 'inspect', 'prune', 'soil'];

function _urgencyFor(rec) {
  const text = `${rec?.title || ''} ${rec?.message || ''}`.toLowerCase();
  if (TODAY_KEYWORDS.some((k) => text.includes(k))) return 'today';
  if (WEEK_KEYWORDS.some((k) => text.includes(k)))  return 'thisWeek';
  return null;
}

const BENEFIT_KEYWORDS = {
  water:        'Consistent watering keeps roots strong.',
  irrigate:     'Steady moisture protects yield.',
  fertilise:    'Right nutrients = bigger harvest.',
  fertilize:    'Right nutrients = bigger harvest.',
  weed:         'Less competition for water and light.',
  prune:        'Better airflow reduces disease risk.',
  inspect:      'Catching problems early saves the crop.',
  harvest:      'Pick at the right time for best price.',
  plant:        'Timing the planting affects the whole season.',
  soil:         'Healthy soil now means a stronger season.',
  spray:        'Targeted treatment stops spread fast.',
};

function _benefitFor(rec) {
  const text = `${rec?.title || ''} ${rec?.message || ''}`.toLowerCase();
  for (const [k, v] of Object.entries(BENEFIT_KEYWORDS)) {
    if (text.includes(k)) return v;
  }
  return 'Small consistent steps improve your harvest.';
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: '0.75rem' },
  motivLine: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
  },
  successBanner: {
    margin: 0,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    color: '#0B1D34',
    background: '#22C55E',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  hero: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))',
    border: '1px solid #22C55E',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
  },
  heroDone: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: 'none',
    opacity: 0.85,
  },
  heroHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTitleCol: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  heroTitle: { fontSize: 17, fontWeight: 800, color: '#fff' },
  heroMessage: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.45, marginTop: 2 },
  heroWhy: {
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
    marginTop: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  heroWhyLabel: {
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: 'rgba(134,239,172,0.85)',
  },
  urgencyChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    flex: '0 0 auto',
  },
  ctaRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '2 1 0',
  },
  primaryDone: {
    background: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'default',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '1 1 0',
  },
  audioRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  listenBtn: {
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.45)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
  listenBtnActive: {
    background: '#22C55E',
    color: '#0B1D34',
  },

  optionalHeading: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  optList: { display: 'flex', flexDirection: 'column', gap: 8 },
  optRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  optRowDone: { opacity: 0.55 },
  optBody: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  optTitle: { fontSize: 14, fontWeight: 700, color: '#fff' },
  optMessage: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 },
  optActions: { display: 'flex', gap: 6, flex: '0 0 auto' },
  optActionBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optActionBtnPrimary: {
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
  },
};

export default function HomeTaskEnhancer({
  recommendations = [],
  currentStageLabel = '',
  progressPct = 0,
  lang = 'en',
}) {
  useTranslation();
  const [tick, setTick] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);    // { kind, message } | null

  // Re-render when state map changes in another tab or after a
  // local mark/skip action (the helper emits the change event).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(HOME_TASK_STATE_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(HOME_TASK_STATE_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  // Decorate recommendations + drop entries the user has already
  // marked done or skipped today.
  const decorated = useMemo(() => {
    const stateMap = getHomeTaskStateMap();
    const all = (recommendations || []).map((rec, idx) => ({
      idx,
      rec,
      key:     taskKeyFor(rec),
      urgency: _urgencyFor(rec),
      benefit: _benefitFor(rec),
      status:  null,
    }));
    return all
      .map((d) => ({ ...d, status: stateMap.get(d.key) || null }))
      .filter((d) => d.status !== 'done' && d.status !== 'skipped');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations, tick]);

  const motivLine = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(progressPct) || 0)));
    if (pct >= 80) {
      return tStrict('home.task.motiv.almost', 'Almost there \u2014 last push of the season.');
    }
    if (pct >= 40) {
      return tStrict('home.task.motiv.middle', 'You\u2019re halfway through. Keep going.');
    }
    if (pct > 0) {
      return tStrict('home.task.motiv.early', 'Strong start. Each task compounds.');
    }
    return tStrict('home.task.motiv.zero', 'Pick one task today to set the rhythm.');
  }, [progressPct]);

  const hero = decorated[0] || null;
  const optionalRows = decorated.slice(1, 3);

  const handleMarkDone = useCallback((d) => {
    if (!d) return;
    try { markHomeTask(d.rec, 'done'); } catch { /* swallow */ }
    try {
      trackEvent('home_task_completed', {
        title: String(d.rec?.title || '').slice(0, 80),
        urgency: d.urgency || null,
      });
    } catch { /* swallow */ }
    // Funnel optimisation §10: stamp first-action when the user
    // completes their first task. Idempotent across calls — only
    // the first ever fires `first_action_completed`.
    try {
      trackFirstAction('task_completed', {
        urgency: d.urgency || null,
      });
    } catch { /* swallow */ }
    // Daily streak system §4: append "+1 day streak" reward when
    // the streak rewards flag is on. Streak is bumped inside
    // markHomeTask above; we read the post-bump value to render.
    let streakLine = '';
    if (isFeatureEnabled('streakRewards')) {
      let count = 0;
      try { count = getStreak(); } catch { count = 0; }
      if (count > 0) {
        streakLine = tStrict(
          'streak.reward.message',
          ' \u00B7 +1 day streak \u2014 you\u2019re at {count}!',
        ).replace('{count}', String(count));
      }
    }
    setFeedback({
      kind: 'done',
      message: tStrict('home.task.feedback.done',
        'Done \u2014 nice work. Your progress just moved.') + streakLine,
    });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const handleSkip = useCallback((d) => {
    if (!d) return;
    try { markHomeTask(d.rec, 'skipped'); } catch { /* swallow */ }
    try {
      trackEvent('home_task_skipped', {
        title: String(d.rec?.title || '').slice(0, 80),
        urgency: d.urgency || null,
      });
    } catch { /* swallow */ }
    setFeedback({
      kind: 'skipped',
      message: tStrict('home.task.feedback.skipped',
        'Got it \u2014 we\u2019ll bring this back tomorrow.'),
    });
    setTimeout(() => setFeedback(null), 3500);
  }, []);

  const handleListen = useCallback(async () => {
    if (speaking) {
      try { stopVoice(); } catch { /* swallow */ }
      setSpeaking(false);
      return;
    }
    if (!hero) return;
    const heroText = [
      hero.rec?.title  ? String(hero.rec.title).trim()  : '',
      hero.rec?.message ? String(hero.rec.message).trim() : '',
    ].filter(Boolean).join(' \u2014 ');
    const stagePrefix = currentStageLabel ? `Current stage: ${currentStageLabel}. ` : '';
    const text = `${stagePrefix}${heroText}`;
    if (!text.trim()) return;
    setSpeaking(true);
    try { trackEvent('home_task_listen', { hasHero: !!hero }); }
    catch { /* swallow */ }
    try { await playVoice(text, { lang }); }
    catch { /* swallow */ }
    setSpeaking(false);
  }, [speaking, hero, currentStageLabel, lang]);

  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return null;
  }

  // Empty state — every recommendation has been marked done/skipped
  // for today. Show a calm motivating line so the section never
  // renders blank.
  if (!hero) {
    return (
      <div style={S.wrap} data-testid="home-task-enhancer-empty">
        <p style={S.motivLine}>
          {tStrict(
            'home.task.allClear',
            'All caught up for today \u2014 nice work. Check back tomorrow.',
          )}
        </p>
      </div>
    );
  }

  const heroTone = hero.urgency ? TONES[hero.urgency] : null;

  return (
    <div style={S.wrap} data-testid="home-task-enhancer">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={S.motivLine}>{motivLine}</p>
        <button
          type="button"
          onClick={handleListen}
          style={{ ...S.listenBtn, ...(speaking ? S.listenBtnActive : null) }}
          data-testid="home-task-listen"
          aria-pressed={speaking ? 'true' : 'false'}
        >
          <span aria-hidden="true">{speaking ? '\u23F8' : '\uD83D\uDD0A'}</span>
          <span>
            {speaking
              ? tStrict('home.task.stopAudio',  'Stop')
              : tStrict('home.task.listenInLang', 'Listen in your language')}
          </span>
        </button>
      </div>

      {feedback ? (
        <div style={S.successBanner} data-testid="home-task-feedback">
          <span aria-hidden="true">{feedback.kind === 'done' ? '\u2728' : '\u2714'}</span>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {/* Hero priority */}
      <section style={S.hero} data-testid="home-task-hero" data-urgency={hero.urgency || ''}>
        <div style={S.heroHead}>
          <div style={S.heroTitleCol}>
            <span style={S.heroEyebrow}>
              {tStrict('home.task.heroEyebrow', 'Today\u2019s priority')}
            </span>
            <span style={S.heroTitle}>{hero.rec?.title || ''}</span>
            {hero.rec?.message ? (
              <span style={S.heroMessage}>{hero.rec.message}</span>
            ) : null}
          </div>
          {hero.urgency && heroTone ? (
            <span
              style={{
                ...S.urgencyChip,
                color: heroTone.color,
                background: heroTone.bg,
                border: `1px solid ${heroTone.border}`,
              }}
              data-testid="home-task-hero-urgency"
            >
              {hero.urgency === 'today'
                ? tStrict('home.task.urgency.today', 'Do this today')
                : tStrict('home.task.urgency.thisWeek', 'This week')}
            </span>
          ) : null}
        </div>

        <span style={S.heroWhy} data-testid="home-task-hero-why">
          <span style={S.heroWhyLabel}>
            {tStrict('home.task.whyLabel', 'Why it matters')}
          </span>
          <span>{tStrict(
            `home.task.benefit.${(hero.rec?.kind || 'generic')}`,
            hero.benefit,
          )}</span>
        </span>

        <div style={S.ctaRow}>
          <button
            type="button"
            onClick={() => handleMarkDone(hero)}
            style={S.primary}
            data-testid="home-task-mark-done"
          >
            {tStrict('home.task.markDone', 'Mark as done')}
          </button>
          <button
            type="button"
            onClick={() => handleSkip(hero)}
            style={S.ghost}
            data-testid="home-task-skip"
          >
            {tStrict('home.task.remindLater', 'Remind me later')}
          </button>
        </div>
      </section>

      {optionalRows.length > 0 ? (
        <>
          <h4 style={S.optionalHeading}>
            {tStrict('home.task.optionalHeading', 'Other tasks for the week')}
          </h4>
          <div style={S.optList}>
            {optionalRows.map((d) => (
              <div
                key={d.key}
                style={S.optRow}
                data-testid={`home-task-opt-${d.idx}`}
                data-urgency={d.urgency || ''}
              >
                <div style={S.optBody}>
                  <span style={S.optTitle}>{d.rec?.title || ''}</span>
                  {d.rec?.message ? (
                    <span style={S.optMessage}>{d.rec.message}</span>
                  ) : null}
                </div>
                <div style={S.optActions}>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(d)}
                    style={{ ...S.optActionBtn, ...S.optActionBtnPrimary }}
                    data-testid={`home-task-opt-done-${d.idx}`}
                  >
                    {tStrict('home.task.markDone', 'Mark as done')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkip(d)}
                    style={S.optActionBtn}
                    data-testid={`home-task-opt-skip-${d.idx}`}
                  >
                    {tStrict('home.task.remindLater', 'Remind me later')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
