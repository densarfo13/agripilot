/**
 * DailyPlanCard — Home-screen surface for the Daily
 * Intelligence engine. Shows greeting + farm + crop stage +
 * weather summary + max 3 actions + alerts.
 *
 * Strict-rule audit
 *   • Reads the active farm + weather from existing contexts
 *     (no new fetches).
 *   • Hides itself when FEATURE_DAILY_INTELLIGENCE is off so
 *     existing Home composition is unchanged.
 *   • "Mark done" writes through dailyTaskCompletion only —
 *     no engine modifications.
 *   • "Ask Farroway" + "Scan crop" buttons reuse the existing
 *     VoiceLauncher / PhotoLauncher launchers.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import { generateDailyPlan } from '../../core/dailyIntelligenceEngine.js';
import { markActionDone } from '../../core/dailyTaskCompletion.js';
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';
import VoiceLauncher from '../voice/VoiceLauncher.jsx';
import PhotoLauncher from '../photo/PhotoLauncher.jsx';

const URGENCY_TONE = {
  high:   { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.32)',  pill: '#FCA5A5' },
  medium: { background: 'rgba(34,197,94,0.10)',  borderColor: 'rgba(34,197,94,0.32)',  pill: '#86EFAC' },
  low:    { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', pill: '#9FB3C8' },
};

const SEVERITY_TONE = {
  critical: { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.32)', color: '#FCA5A5' },
  warning:  { background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.32)', color: '#FDE68A' },
  info:     { background: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.32)', color: '#93C5FD' },
};

export default function DailyPlanCard({
  farm,
  weather = null,
  weatherStale = false,
  recentTasks = [],
  greetingName,
  onMarkDone,
  style,
}) {
  const { lang } = useTranslation();
  const navigate = useNavigate();
  const [version, setVersion] = React.useState(0);

  if (!isFeatureEnabled('FEATURE_DAILY_INTELLIGENCE')) return null;
  if (!farm) return null;

  // Re-run the engine when version bumps (after a Mark-done).
  const plan = React.useMemo(
    () => generateDailyPlan({ farm, weather, weatherStale, recentTasks }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farm, weather, weatherStale, recentTasks, version],
  );

  // Telemetry: log once per (farmId, date) so we can see the
  // generation rate in the admin "Daily Intelligence Usage" card.
  const loggedKey = React.useRef('');
  React.useEffect(() => {
    if (!plan || !plan.farmId) return;
    const key = `${plan.farmId}:${plan.date}`;
    if (loggedKey.current === key) return;
    loggedKey.current = key;
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_GENERATED || 'daily_plan_generated', {
        farmId:     plan.farmId,
        cropId:     plan.cropId,
        cropStage:  plan.cropStage,
        confidence: plan.confidence,
        actions:    plan.actions.length,
        alerts:     plan.alerts.length,
      });
    } catch { /* swallow */ }
  }, [plan]);

  function handleMarkDone(action) {
    if (!isFeatureEnabled('FEATURE_AUTO_TASK_GENERATION')) return;
    markActionDone(farm.id, action);
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_ACTION_DONE || 'daily_plan_action_done',
        { farmId: farm.id, actionId: action.id, actionType: action.actionType });
    } catch { /* swallow */ }
    if (typeof onMarkDone === 'function') onMarkDone(action);
    setVersion((v) => v + 1);
  }

  function handleRemindLater(action) {
    // Remind-later doesn't add to completion store — the
    // action will simply re-appear next time the engine runs
    // (which is on every Home open). Lightweight telemetry only.
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_ACTION_SNOOZED || 'daily_plan_action_snoozed',
        { farmId: farm.id, actionId: action.id });
    } catch { /* swallow */ }
  }

  function handleSellPrep() {
    try { navigate('/sell'); } catch { /* ignore */ }
  }

  const greeting = greetingName
    ? `${tSafe('daily.greeting', 'Good day,')} ${greetingName}`
    : tSafe('daily.greetingNoName', 'Good day');

  const farmName = farm.farmName || farm.name || tSafe('daily.farmFallback', 'Your farm');

  return (
    <section
      style={{ ...S.card, ...(style || {}) }}
      data-testid="daily-plan-card"
    >
      {/* ── Header: greeting + farm + stage + weather ── */}
      <div style={S.headerRow}>
        <div>
          <p style={S.greeting}>{greeting}</p>
          <p style={S.farmLine}>
            {farmName}
            {plan.cropStage && (
              <>
                {' '}·{' '}
                <span style={S.stagePill}>
                  {tSafe(`cropStage.${camelStage(plan.cropStage)}`,
                    humanStage(plan.cropStage))}
                </span>
              </>
            )}
          </p>
        </div>
        <span
          style={{
            ...S.confidencePill,
            ...(plan.confidence === 'high'
              ? { borderColor: 'rgba(34,197,94,0.32)', color: '#86EFAC' }
              : plan.confidence === 'medium'
                ? { borderColor: 'rgba(59,130,246,0.32)', color: '#93C5FD' }
                : { borderColor: 'rgba(245,158,11,0.32)', color: '#FCD34D' }),
          }}
          aria-label={tSafe('daily.confidence', 'Confidence')}
        >
          {tSafe(`daily.confidence.${plan.confidence}`,
            plan.confidence.charAt(0).toUpperCase() + plan.confidence.slice(1))}
        </span>
      </div>

      {plan.summary && (
        <p style={S.summary} data-testid="daily-plan-summary">
          {plan.summary}
        </p>
      )}

      {plan.weatherStale && (
        <p style={S.staleNote}>
          {tSafe('daily.weatherStale',
            'Weather data may be outdated — connect to refresh.')}
        </p>
      )}

      {/* ── Alerts (severity-ordered) ── */}
      {plan.alerts && plan.alerts.length > 0 && (
        <div style={S.alertsRow}>
          {plan.alerts.slice(0, 2).map((al) => (
            <div
              key={al.id}
              style={{ ...S.alert, ...(SEVERITY_TONE[al.severity] || SEVERITY_TONE.info) }}
              data-testid={`daily-alert-${al.id}`}
            >
              <strong>{al.title}</strong>
              <span>{al.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Actions (max 3) ── */}
      {plan.actions && plan.actions.length > 0 && (
        <>
          <p style={S.sectionLabel}>
            {tSafe('daily.topActions', 'Today\u2019s top actions')}
          </p>
          <ul style={S.actionList}>
            {plan.actions.map((a) => (
              <li
                key={a.id}
                style={{ ...S.actionRow, ...(URGENCY_TONE[a.urgency] || URGENCY_TONE.low) }}
                data-testid={`daily-action-${a.id}`}
              >
                <div style={S.actionBody}>
                  <p style={S.actionTitle}>{a.title}</p>
                  <p style={S.actionReason}>{a.reason}</p>
                </div>
                <div style={S.actionButtons}>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(a)}
                    style={{ ...S.btn, ...S.btnPrimary }}
                    data-testid={`daily-mark-done-${a.id}`}
                  >
                    {tSafe('daily.markDone', 'Mark done')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemindLater(a)}
                    style={{ ...S.btn, ...S.btnGhost }}
                    data-testid={`daily-remind-${a.id}`}
                  >
                    {tSafe('daily.remindLater', 'Remind me later')}
                  </button>
                  {a.actionType === 'sell' && (
                    <button
                      type="button"
                      onClick={handleSellPrep}
                      style={{ ...S.btn, ...S.btnPrimary }}
                      data-testid={`daily-sell-${a.id}`}
                    >
                      {tSafe('daily.prepareToSell', 'Prepare to sell')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {(!plan.actions || plan.actions.length === 0) && (
        <p style={S.empty}>
          {tSafe('daily.noActions',
            'No actions for today — keep watching the field and check back tomorrow.')}
        </p>
      )}

      {/* ── Footer: Ask Farroway + Scan crop ── */}
      <div style={S.footerRow}>
        <VoiceLauncher variant="chip" />
        <PhotoLauncher
          variant="chip"
          farmId={farm.id || null}
          cropId={plan.cropId || null}
        />
      </div>
    </section>
  );
}

function camelStage(stage) {
  if (!stage) return '';
  return String(stage).replace(/_(\w)/g, (_, c) => c.toUpperCase());
}
function humanStage(stage) {
  if (!stage) return '';
  return String(stage).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const S = {
  card: {
    margin: '0.75rem 0',
    padding: '1rem',
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.04) 100%)',
    border: '1px solid rgba(34,197,94,0.22)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem',
  },
  greeting: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600 },
  farmLine: { margin: '0.125rem 0 0', fontSize: '1.0625rem', fontWeight: 700 },
  stagePill: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: 999,
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  confidencePill: {
    padding: '0.25rem 0.625rem',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  summary: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.45,
    color: '#F1F5F9',
  },
  staleNote: {
    margin: 0,
    padding: '0.4rem 0.625rem',
    borderRadius: 8,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.75rem',
  },
  alertsRow: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  alert: {
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    border: '1px solid',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '0.6875rem', color: '#9FB3C8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  actionList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  actionRow: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  actionBody: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  actionTitle: { margin: 0, fontSize: '0.9375rem', fontWeight: 700 },
  actionReason: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  actionButtons: { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  btnPrimary: { background: '#22C55E', color: '#062714', borderColor: '#22C55E' },
  btnGhost: { background: 'transparent', color: '#EAF2FF' },
  empty: { margin: 0, color: '#9FB3C8', fontSize: '0.875rem' },
  footerRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
};
