/**
 * TodayTaskCard — server-driven primary action card.
 *
 *   <TodayTaskCard />
 *
 * Calls POST /api/tasks/today on mount, renders the spec's
 * envelope: ONE task, "DO THIS NOW" CTA, completion confirmation.
 *
 * Why this is a separate component from FirstActionGate
 * ─────────────────────────────────────────────────────
 *   FirstActionGate already renders a primary action from the
 *   client-side decision engine (`primaryActionEngine` →
 *   `ultimateDecisionEngine`). This new card is the SERVER-
 *   DRIVEN equivalent that consumes the AI Task Engine v1
 *   endpoint. They coexist:
 *
 *     • Default (FEATURE_AI_TASK_ENGINE = false): FirstActionGate
 *       owns the home screen, identical to before. No change.
 *     • Opt-in (FEATURE_AI_TASK_ENGINE = true): TodayTaskCard
 *       is mounted at the top of Home and FirstActionGate is
 *       hidden. The server's rules engine becomes the source.
 *
 *   This split keeps the soft-launch rollout reversible: flip
 *   the flag back to OFF and the legacy renderer is restored.
 *
 * Strict-rule audit
 *   • Never throws — every fetch / parse path is try/catched.
 *   • Falls back to a generic "Take a quick look at your plants"
 *     when the API is unreachable so the home screen is never
 *     blank.
 *   • Fires `task_viewed` on render success and `task_completed`
 *     on Done press.
 *   • All visible text via `tSafe` so missing keys never leak
 *     raw English.
 *   • Pure ESM, top-level imports only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Calm-UI spec §11 — subtle fade-in keyframe injected once at
// module load. We avoid a global CSS file change so the
// component stays self-contained. No bounce, 150–250 ms only.
if (typeof document !== 'undefined' && !document.getElementById('farroway-fadeIn-keyframes')) {
  const sty = document.createElement('style');
  sty.id = 'farroway-fadeIn-keyframes';
  sty.textContent = '@keyframes farroway-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }';
  try { document.head.appendChild(sty); } catch { /* swallow — SSR / locked DOM */ }
}
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import api from '../../api/client.js';
import { trackEvent } from '../../core/analytics.js';
import { getCurrentLang } from '../../utils/i18n.js';
import { resolveContext } from '../../core/contextResolver.js';

// Local fallback envelope — used when the network call fails.
// Mirrors the server's `fallback_check` rule shape so downstream
// consumers don't branch. Calm-UI spec §14 — Home must never
// blank on weather/API failure; spec wording exact:
//   farmer  → "Check your crop today"
//   backyard → "Check your plant today"
function buildLocalFallback(userType, language) {
  const ut = userType === 'backyard' ? 'backyard' : 'farmer';
  const isBackyard = ut === 'backyard';
  return {
    todayTaskTitle: isBackyard
      ? tSafe('todayTask.fallback.backyard.title', 'Check your plant today')
      : tSafe('todayTask.fallback.farmer.title',   'Check your crop today'),
    taskReason: isBackyard
      ? tSafe('todayTask.fallback.backyard.reason', 'A quick look every day keeps plants healthy.')
      : tSafe('todayTask.fallback.farmer.reason',   'A 10-minute walk catches early problems.'),
    urgency:        'low',
    estimatedTime:  isBackyard ? '3 min' : '10 min',
    safetyNote:     null,
    localizedText: {
      title:  null,
      reason: null,
      safetyNote: null,
      completionPrompt: tSafe('todayTask.completionPrompt',
        'Nice — you stayed ahead today \uD83C\uDF31'),
    },
    nextRecommendedTask: isBackyard
      ? tSafe('todayTask.nextSoonBackyard', 'Check again tomorrow morning')
      : tSafe('todayTask.nextSoonFarmer',   'Check again tomorrow morning'),
    completionPrompt: tSafe('todayTask.completionPrompt',
      'Nice — you stayed ahead today \uD83C\uDF31'),
    // Final-polish spec §4 — local fallback also carries a CTA
    // so the button text never reads from the raw default in
    // a network-down render path.
    ctaLabel: tSafe('todayTask.cta', 'Check now \u2713'),
    ruleId:    'local_fallback',
    userType:  ut,
    fallback:  true,
    language,
    generatedAt: new Date().toISOString(),
  };
}

// Calm-UI spec §3 — dynamic weather/context header. Adapts to
// the rule the server's AI Task Engine fired so the line on
// Home matches the action below it. Falls back to "Here's
// today's guidance" when no weather signal applies.
function _resolveWeatherHeader(task) {
  if (!task) return tSafe('todayTask.header.fallback', "Here\u2019s today\u2019s guidance");
  switch (task.ruleId) {
    case 'heavy_rain_warning':
      return '\uD83C\uDF27\uFE0F ' + tSafe('todayTask.header.rain',
        'Rain expected \u2014 hold watering today');
    case 'heat_stress_warning':
      return '\u2600\uFE0F ' + tSafe('todayTask.header.hot',
        'Hot today \u2014 check soil early');
    case 'cold_stress_warning':
      return '\u2744\uFE0F ' + tSafe('todayTask.header.cold',
        'Cold tonight \u2014 protect plants');
    case 'dry_irrigation':
      return '\u2600\uFE0F ' + tSafe('todayTask.header.dry',
        'Dry spell \u2014 water deeply today');
    case 'profile_missing':
      return '\uD83C\uDF31 ' + tSafe('todayTask.header.setup',
        'Quick setup needed');
    default:
      return '\uD83C\uDF24\uFE0F ' + tSafe('todayTask.header.normal',
        'Good day for a quick check');
  }
}

export default function TodayTaskCard({ userType: userTypeProp, onDone }) {
  useTranslation();
  const [task, setTask]   = useState(null);
  const [done, setDone]   = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fired = useRef({ viewed: false, completed: false });

  // Resolve the userType + language + crop/stage context once
  // per mount. resolveContext is the canonical reader; falls
  // through gracefully when the user hasn't finished onboarding.
  const ctx = useMemo(() => {
    let resolved = {};
    try { resolved = resolveContext() || {}; }
    catch { resolved = {}; }
    return {
      userType: userTypeProp
        || (resolved.userType === 'backyard' ? 'backyard' : 'farmer'),
      crop:     resolved.cropOrPlant || resolved.crop || null,
      stage:    resolved.stage || null,
      country:  resolved.country || null,
      region:   resolved.location || resolved.region || null,
      language: getCurrentLang() || 'en',
    };
  }, [userTypeProp]);

  // Fetch the task. Never throws.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/tasks/today', {
          userType: ctx.userType,
          crop:     ctx.crop || undefined,
          stage:    ctx.stage || undefined,
          country:  ctx.country || undefined,
          region:   ctx.region || undefined,
          language: ctx.language,
        });
        if (cancelled) return;
        const envelope = res && res.data ? res.data : res;
        setTask(envelope || buildLocalFallback(ctx.userType, ctx.language));
        if (!fired.current.viewed) {
          try {
            trackEvent('task_viewed', {
              source:    'today_task_card',
              ruleId:    envelope?.ruleId,
              urgency:   envelope?.urgency,
              userType:  envelope?.userType,
              fallback:  !!envelope?.fallback,
            });
          } catch { /* swallow */ }
          fired.current.viewed = true;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        // Local fallback — home screen is never blank.
        const fb = buildLocalFallback(ctx.userType, ctx.language);
        setTask(fb);
        try {
          trackEvent('task_viewed', {
            source: 'today_task_card_fallback',
            ruleId: fb.ruleId,
            fallback: true,
          });
        } catch { /* swallow */ }
        fired.current.viewed = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ctx.userType, ctx.crop, ctx.stage, ctx.country, ctx.region, ctx.language]);

  const handleDone = useCallback(() => {
    if (done) return;
    setDone(true);
    if (!fired.current.completed) {
      try {
        trackEvent('task_completed', {
          source:   'today_task_card',
          ruleId:   task?.ruleId,
          userType: task?.userType,
        });
      } catch { /* swallow */ }
      fired.current.completed = true;
    }
    if (typeof onDone === 'function') {
      try { onDone(task); } catch { /* swallow */ }
    }
  }, [done, task, onDone]);

  if (loading || !task) {
    return (
      <div style={S.card} data-testid="today-task-card-loading">
        <div style={S.skeleton} />
      </div>
    );
  }

  // Calm-UI spec §2 — Tomorrow hook is part of the done state.
  // Wording per spec: "Nice — you stayed ahead today 🌱" + the
  // next-tomorrow line "Check again tomorrow morning".
  if (done) {
    return (
      <>
        <div style={S.headerLine} data-testid="today-task-header-done">
          {_resolveWeatherHeader(task)}
        </div>
        <div style={S.cardDone} data-testid="today-task-card-done">
          <div style={S.eyebrowDone}>{tSafe('todayTask.doneEyebrow', 'Done')}</div>
          <h2 style={S.title}>
            {task.completionPrompt
              || tSafe('todayTask.completionPrompt',
                'Nice \u2014 you stayed ahead today \uD83C\uDF31')}
          </h2>
          <p style={S.tomorrowHook}>
            <span aria-hidden="true">{'\uD83C\uDF1E'}</span>{' '}
            {task.nextRecommendedTask
              || tSafe('todayTask.tomorrowHook', 'Check again tomorrow morning')}
          </p>
        </div>
      </>
    );
  }

  const urgencyColor = task.urgency === 'high'
    ? '#FCA5A5'
    : task.urgency === 'medium'
      ? '#FCD34D'
      : '#86EFAC';

  // Calm-UI spec §5 — scan prompt below the primary action.
  // Wording adapts per userType but the nav target stays /scan.
  const isBackyard = task.userType === 'backyard';
  const scanLineHeading = isBackyard
    ? tSafe('todayTask.scanPromptHeadingBackyard', 'See something wrong?')
    : tSafe('todayTask.scanPromptHeadingFarmer',   'See crop damage?');
  const scanLineCta = isBackyard
    ? tSafe('todayTask.scanPromptCtaBackyard', 'Scan your plant')
    : tSafe('todayTask.scanPromptCtaFarmer',   'Scan crop');

  return (
    <>
      {/* Calm-UI spec §3 — dynamic weather/context header.
          Sits ABOVE the primary card so the user reads
          context first, then the action. */}
      <div style={S.headerLine} data-testid="today-task-header">
        {_resolveWeatherHeader(task)}
      </div>

      <div style={S.card} data-testid="today-task-card">
        <div style={S.eyebrowRow}>
          <span style={{ ...S.eyebrow, color: urgencyColor }}>
            {tSafe(`todayTask.urgency.${task.urgency}`, task.urgency || 'now')}
          </span>
          <span style={S.estimate}>{task.estimatedTime}</span>
        </div>
        <h2 style={S.title}>{task.todayTaskTitle}</h2>
        <p style={S.reason}>{task.taskReason}</p>
        {task.safetyNote ? (
          <p style={S.safety}>
            <span aria-hidden="true">{'\u26A0\uFE0F'}</span> {task.safetyNote}
          </p>
        ) : null}
        {/* Final-polish spec §4 — CTA must match the action.
            Engine returns `ctaLabel` per rule + userType + locale.
            Falls back to localizedText.ctaLabel, then the
            universal "Check now \u2713" so older clients still
            render a sensible button. */}
        <button
          type="button"
          onClick={handleDone}
          style={S.cta}
          data-testid="today-task-cta"
        >
          {task.ctaLabel
            || (task.localizedText && task.localizedText.ctaLabel)
            || tSafe('todayTask.cta', 'Check now \u2713')}
        </button>
        {error ? (
          <p style={S.subtle}>
            {tSafe('todayTask.offlineHint',
              'Showing a basic task \u2014 we\u2019ll update once you\u2019re back online.')}
          </p>
        ) : null}
      </div>

      {/* Calm-UI spec §5 — scan prompt below the primary card.
          Helpful, not required. Tap → /scan. */}
      <button
        type="button"
        onClick={() => {
          try {
            if (typeof window !== 'undefined') window.location.assign('/scan');
          } catch { /* swallow */ }
        }}
        style={S.scanPrompt}
        data-testid="today-task-scan-prompt"
      >
        <span style={S.scanPromptIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
        <span style={S.scanPromptText}>
          <span style={S.scanPromptHeading}>{scanLineHeading}</span>
          <span style={S.scanPromptCta}>{scanLineCta}</span>
        </span>
        <span style={S.scanPromptArrow} aria-hidden="true">{'\u203A'}</span>
      </button>
    </>
  );
}

const S = {
  // Calm-UI spec §3 — dynamic weather/context header above the
  // primary card. Single line, lightweight, sits flush with
  // the card's outer container so visual focus drops naturally
  // into the action below.
  headerLine: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto 8px',
    padding: '0 4px',
    color: '#9FB3C8',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.01em',
    // Subtle motion per spec §11 — fade-in only, no bounce.
    animation: 'farroway-fadeIn 200ms ease-out',
  },
  card: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 18px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    animation: 'farroway-fadeIn 220ms ease-out',
  },
  // Done state mirrors `card` but adds a soft green accent so
  // the success feels emotional, not analytical (spec §8 vibe).
  cardDone: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: 16,
    padding: '20px 18px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    animation: 'farroway-fadeIn 250ms ease-out',
  },
  tomorrowHook: {
    margin: '4px 0 0',
    color: '#86EFAC',
    fontSize: 14,
    fontWeight: 600,
  },
  // Calm-UI spec §5 — scan prompt sits below the primary action.
  // Soft chip styling (white-on-dark) so it never competes with
  // the green CTA above.
  scanPrompt: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: '32rem',
    margin: '12px auto 0',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    color: '#EAF2FF',
    cursor: 'pointer',
    textAlign: 'left',
    animation: 'farroway-fadeIn 280ms ease-out',
    minHeight: 48,
  },
  scanPromptIcon:    { fontSize: 22, lineHeight: 1 },
  scanPromptText:    { display: 'flex', flexDirection: 'column', flex: 1, gap: 2 },
  scanPromptHeading: { fontSize: 12, color: '#9FB3C8', fontWeight: 600 },
  scanPromptCta:     { fontSize: 14, color: '#EAF2FF', fontWeight: 700 },
  scanPromptArrow:   { color: '#9FB3C8', fontSize: 18, lineHeight: 1 },
  eyebrowRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  eyebrowDone: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#22C55E',
  },
  estimate: {
    fontSize: 12,
    color: '#7A8FA6',
    fontWeight: 600,
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  reason: {
    margin: 0,
    color: '#9FB3C8',
    fontSize: 14,
    lineHeight: 1.5,
  },
  safety: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#FCD34D',
    background: 'rgba(252,211,77,0.08)',
    border: '1px solid rgba(252,211,77,0.20)',
    borderRadius: 10,
    padding: '8px 10px',
  },
  cta: {
    marginTop: 6,
    background: '#22C55E',
    color: '#062714',
    border: 'none',
    borderRadius: 12,
    padding: '14px 18px',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    minHeight: 48,
    letterSpacing: '0.04em',
  },
  next: {
    margin: '8px 0 0',
    color: '#9FB3C8',
    fontSize: 13,
  },
  subtle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#7A8FA6',
  },
  skeleton: {
    height: 120,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
};
