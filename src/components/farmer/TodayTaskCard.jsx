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
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import api from '../../api/client.js';
import { trackEvent } from '../../core/analytics.js';
import { getCurrentLang } from '../../utils/i18n.js';
import { resolveContext } from '../../core/contextResolver.js';

// Local fallback envelope — used when the network call fails.
// Mirrors the server's `fallback_check` rule shape so downstream
// consumers don't branch.
function buildLocalFallback(userType, language) {
  const ut = userType === 'backyard' ? 'backyard' : 'farmer';
  const isBackyard = ut === 'backyard';
  return {
    todayTaskTitle: isBackyard
      ? tSafe('todayTask.fallback.backyard.title', 'Look at your plants today')
      : tSafe('todayTask.fallback.farmer.title',   'Walk your farm and look'),
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
        'Great job. Next task will update soon.'),
    },
    nextRecommendedTask: tSafe('todayTask.nextSoon', 'Next task soon.'),
    completionPrompt: tSafe('todayTask.completionPrompt',
      'Great job. Next task will update soon.'),
    ruleId:    'local_fallback',
    userType:  ut,
    fallback:  true,
    language,
    generatedAt: new Date().toISOString(),
  };
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

  if (done) {
    return (
      <div style={S.card} data-testid="today-task-card-done">
        <div style={S.eyebrowDone}>{tSafe('todayTask.doneEyebrow', 'Done')}</div>
        <h2 style={S.title}>
          {task.completionPrompt
            || tSafe('todayTask.completionPrompt',
              'Great job. Next task will update soon.')}
        </h2>
        {task.nextRecommendedTask ? (
          <p style={S.next}>
            {tSafe('todayTask.nextLabel', 'Next:')}{' '}
            {task.nextRecommendedTask}
          </p>
        ) : null}
      </div>
    );
  }

  const urgencyColor = task.urgency === 'high'
    ? '#FCA5A5'
    : task.urgency === 'medium'
      ? '#FCD34D'
      : '#86EFAC';

  return (
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
      <button
        type="button"
        onClick={handleDone}
        style={S.cta}
        data-testid="today-task-cta"
      >
        {tSafe('todayTask.cta', 'DO THIS NOW')}
      </button>
      {error ? (
        <p style={S.subtle}>
          {tSafe('todayTask.offlineHint',
            'Showing a basic task — we\u2019ll update once you\u2019re back online.')}
        </p>
      ) : null}
    </div>
  );
}

const S = {
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
  },
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
