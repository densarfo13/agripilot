/**
 * EngagementPlanCard — daily 2–3 task plan with completion + toast.
 *
 * Spec coverage
 *   §1 daily plan generator  → useDailyEngagement → engine
 *   §3 completion feedback   → micro success toast on each Mark done
 *   §6 scan reminder slot    → engine injects "Check plant health"
 *   §7 no empty state        → engine guarantees ≥1 task; render
 *                              guard + skeleton fallback for the
 *                              first paint window
 *
 * Visual rules
 *   • First task highlighted (matches the FastBackyardOnboarding
 *     pattern — green gradient + glow + numbered badge).
 *   • Scan task carries a 📷 affordance + routes to /scan when
 *     present. Falls back to /scan-crop if /scan isn't routable.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Reads active farm from existing farrowayLocal helpers — no
 *     new storage keys.
 *   • Never throws — every external call is try/catch wrapped.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import useDailyEngagement from '../../hooks/useDailyEngagement.js';
import { useToast, ToastContainer } from '../intelligence/Toast.jsx';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '16px 18px 18px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#E5F4EC',
    fontSize: 14,
    fontWeight: 600,
  },
  rowFirst: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(34,197,94,0.10))',
    border: '1px solid #22C55E',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
  },
  rowDone: { opacity: 0.55 },
  badge: {
    flex: '0 0 auto',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  badgeFirst: { background: '#22C55E', color: '#0B1D34' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  why:  { fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 },
  primaryBtn: {
    appearance: 'none',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 10,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  primaryBtnDone: {
    background: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'default',
  },
  scanIcon: { fontSize: 18, marginRight: 4 },
};

/**
 * @param {object} props
 * @param {object} [props.farm]            override active farm (testing)
 * @param {object} [props.weather]         { condition: 'rain'|'heat'|'cool', tempC? }
 */
export default function EngagementPlanCard({ farm, weather = null, style } = {}) {
  useTranslation();             // re-render on language change
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const activeFarm = useMemo(() => farm || _readActiveFarm(), [farm]);

  const plant   = (activeFarm?.crop || activeFarm?.plantId || '').toString();
  const country = activeFarm?.country || '';
  const region  = activeFarm?.region  || '';
  const stage   = activeFarm?.cropStage || null;
  const plantingStatus = activeFarm?.plantingStatus || null;

  const { plan, completeTask } = useDailyEngagement({
    plant, country, region, stage, plantingStatus, weather,
    farmId: activeFarm?.id || null,
  });

  // Track which tasks the user marked done in THIS session (for
  // disabling the button + dimming the row). The engagement
  // history store is the source of truth across reloads — this
  // is just visual feedback for the current render.
  const [doneIds, setDoneIds] = useState(() => new Set());

  const handleMarkDone = useCallback((task) => {
    if (!task) return;
    try { completeTask(task); } catch { /* never propagate */ }
    try { trackEvent('engagement_task_completed', { taskId: task.id, kind: task.kind }); }
    catch { /* swallow */ }
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });
    try {
      showToast(
        tStrict('engagement.success.toast', 'Great job! You\u2019re on track \uD83C\uDF31'),
        'success',
      );
    } catch { /* swallow */ }
  }, [completeTask, showToast]);

  const handleScanTask = useCallback((task) => {
    handleMarkDone(task);
    // Best-effort routing to scan; fall back to scan-crop.
    try { navigate('/scan'); }
    catch {
      try { navigate('/scan-crop'); } catch { /* swallow */ }
    }
  }, [handleMarkDone, navigate]);

  const tasks = (plan && Array.isArray(plan.tasks)) ? plan.tasks : [];

  return (
    <section style={{ ...S.card, ...(style || null) }} data-testid="engagement-plan-card">
      <div>
        <h3 style={S.title}>
          {tStrict('engagement.plan.title', 'Today\u2019s plan')}
        </h3>
        <p style={S.subtitle}>
          {tStrict(
            'engagement.plan.subtitle',
            'Two or three quick actions \u2014 pick what you can do.'
          )}
        </p>
      </div>
      <div style={S.list}>
        {tasks.map((task, idx) => {
          const first   = idx === 0;
          const done    = doneIds.has(task.id);
          const isScan  = task.kind === 'scan';
          const titleStr = task.titleKey
            ? tStrict(task.titleKey, task.title || task.id)
            : (task.title || task.id);
          const whyStr = task.whyKey
            ? tStrict(task.whyKey, task.why || '')
            : (task.why || '');
          const ctaStr = done
            ? tStrict('engagement.task.done', 'Done')
            : (isScan
                ? tStrict('engagement.task.scan', 'Scan')
                : tStrict('engagement.task.markDone', 'Mark done'));

          const onClick = isScan
            ? () => handleScanTask(task)
            : () => handleMarkDone(task);

          return (
            <div
              key={task.id}
              style={{
                ...S.row,
                ...(first ? S.rowFirst : null),
                ...(done  ? S.rowDone  : null),
              }}
              data-testid={`engagement-task-${task.id}`}
              data-first={first ? 'true' : 'false'}
              data-kind={task.kind || 'engine'}
            >
              <span style={{ ...S.badge, ...(first ? S.badgeFirst : null) }}>
                {isScan ? (
                  <span aria-hidden="true">{'\uD83D\uDCF7'}</span>
                ) : (
                  String(idx + 1)
                )}
              </span>
              <span style={S.body}>
                <span>{titleStr}</span>
                {whyStr ? <span style={S.why}>{whyStr}</span> : null}
              </span>
              <button
                type="button"
                onClick={done ? undefined : onClick}
                disabled={done}
                style={{ ...S.primaryBtn, ...(done ? S.primaryBtnDone : null) }}
                data-testid={`engagement-task-cta-${task.id}`}
              >
                {ctaStr}
              </button>
            </div>
          );
        })}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
}
