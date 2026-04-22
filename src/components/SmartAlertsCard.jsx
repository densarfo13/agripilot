import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { generateSmartAlerts } from '../lib/intelligence/smartAlertEngine.js';

/**
 * SmartAlertsCard — context-aware alert feed on the dashboard.
 *
 * Runs the Smart Alert engine client-side (pure, cheap, offline-
 * safe) against the current farm + weather and renders the top N
 * alerts. Each alert is an actionable sentence plus a "why this?"
 * disclosure that reveals the reason + consequence.
 *
 * Dismiss state is local (localStorage keyed by alertId) so farmers
 * don't see the same card after they've acknowledged it. Because
 * alert IDs embed the date, a new day means a fresh alert set —
 * dismissals don't suppress tomorrow's equivalents.
 *
 * Props
 *   farm             — required. Farm object from ProfileContext.
 *   weather          — optional. weatherService snapshot.
 *   completedTaskIds — optional Set|array of templateIds the farmer
 *                      has marked done today — powers the
 *                      'missed_task' rule.
 *   persist          — boolean (default true). When true the card
 *                      POSTs new alerts to /notifications/.../smart-
 *                      alerts/dispatch so they show up in the
 *                      notifications feed + history.
 *   maxRows          — int (default 4). Clip the visible list.
 *   onDismiss        — optional callback (alertId) => void.
 */
const STORAGE_KEY = 'farroway:smartAlerts:dismissed:v1';
const DISPATCH_COOLDOWN_MS = 60 * 1000;
let lastDispatchAt = 0;

export default function SmartAlertsCard({
  farm,
  weather = null,
  completedTaskIds = null,
  persist = true,
  maxRows = 4,
  onDismiss = null,
}) {
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(), []);

  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [expandedId, setExpandedId] = useState(null);

  // Pure engine call — memoised against the few inputs that actually
  // change. The engine itself is fast (<1 ms) but re-running on every
  // render still churns React lists.
  const alerts = useMemo(() => {
    if (!farm) return [];
    const list = generateSmartAlerts({
      farm,
      weather,
      completedTaskIds: completedTaskIds || null,
      date: new Date(),
    });
    return list.filter((a) => !dismissed.has(a.id));
  }, [farm, weather, completedTaskIds, dismissed]);

  // Fire-and-forget server dispatch for persistence. Throttled so
  // rapid re-renders don't hammer the endpoint. Farmer id comes from
  // the farm record (farmerId) — without it we skip persistence
  // silently (client-only mode still works).
  useEffect(() => {
    if (!persist || !farm || !farm.farmerId) return;
    if (alerts.length === 0) return;
    const now = Date.now();
    if (now - lastDispatchAt < DISPATCH_COOLDOWN_MS) return;
    lastDispatchAt = now;
    const payload = alerts.map((a) => ({
      id: a.id, type: a.type, priority: a.priority,
      action: a.action, reason: a.reason, consequence: a.consequence,
      messageKey: a.messageKey, triggeredBy: a.triggeredBy,
    }));
    fetch(`/api/notifications/farmer/${encodeURIComponent(farm.farmerId)}/smart-alerts/dispatch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: payload }),
    }).catch(() => { /* non-fatal — client view already has them */ });
  }, [alerts, persist, farm]);

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  const handleDismiss = useCallback((alertId) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      writeDismissed(next);
      return next;
    });
    onDismiss && onDismiss(alertId);
  }, [onDismiss]);

  if (!farm) return null;
  const visible = alerts.slice(0, maxRows);
  const hiddenCount = Math.max(0, alerts.length - visible.length);

  if (visible.length === 0) {
    return (
      <section style={styles.root} data-testid="smart-alerts"
               aria-label={tr('alerts.title', 'Smart alerts')}>
        <header style={styles.header}>
          <h3 style={styles.title}>{tr('alerts.title', 'Smart alerts')}</h3>
        </header>
        <div style={styles.empty} data-testid="smart-alerts-empty">
          {tr('alerts.empty',
              'No alerts right now. We\u2019ll ping you when something needs action.')}
        </div>
      </section>
    );
  }

  return (
    <section style={styles.root} data-testid="smart-alerts"
             aria-label={tr('alerts.title', 'Smart alerts')}>
      <header style={styles.header}>
        <h3 style={styles.title}>
          {tr('alerts.title', 'Smart alerts')}
          <span style={styles.countPill}>{alerts.length}</span>
        </h3>
      </header>

      <ul style={styles.list}>
        {visible.map((a) => (
          <li key={a.id} style={{
                ...styles.row, ...toneForPriority(a.priority),
              }} data-testid={`smart-alert-${a.id}`}>
            <div style={styles.rowMain}>
              <div style={styles.rowTitleLine}>
                <PriorityDot priority={a.priority} />
                <span style={styles.rowTitle}>{a.action}</span>
              </div>
              <button type="button" style={styles.whyBtn}
                      onClick={() => setExpandedId((x) => x === a.id ? null : a.id)}
                      data-testid={`smart-alert-why-${a.id}`}>
                {expandedId === a.id
                  ? tr('alerts.hideWhy', 'Hide details')
                  : tr('alerts.showWhy', 'Why this?')}
              </button>
              {expandedId === a.id && (
                <div style={styles.expanded}>
                  {a.reason && (
                    <p style={styles.paragraph}>
                      <strong style={styles.kicker}>
                        {tr('alerts.reason', 'Reason')}:
                      </strong>{' '}
                      {a.reason}
                    </p>
                  )}
                  {a.consequence && (
                    <p style={styles.paragraph}>
                      <strong style={styles.kicker}>
                        {tr('alerts.consequence', 'If ignored')}:
                      </strong>{' '}
                      {a.consequence}
                    </p>
                  )}
                </div>
              )}
            </div>
            <button type="button" style={styles.dismissBtn}
                    onClick={() => handleDismiss(a.id)}
                    aria-label={tr('alerts.dismiss', 'Dismiss')}
                    data-testid={`smart-alert-dismiss-${a.id}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div style={styles.more}>
          +{hiddenCount} {tr('alerts.moreAlerts', 'more alerts')}
        </div>
      )}
    </section>
  );
}

function PriorityDot({ priority }) {
  const color = priority === 'high'   ? '#FCA5A5'
              : priority === 'medium' ? '#FCD34D'
                                       : '#86EFAC';
  return (
    <span aria-hidden style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, display: 'inline-block',
    }} />
  );
}

function toneForPriority(priority) {
  if (priority === 'high')   return { borderColor: 'rgba(239,68,68,0.32)' };
  if (priority === 'medium') return { borderColor: 'rgba(252,211,77,0.32)' };
  return { borderColor: 'rgba(34,197,94,0.32)' };
}

// ─── Dismiss state ───────────────────────────────────────────────
function readDismissed() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return new Set();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function writeDismissed(set) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch { /* no-op */ }
}

// ─── Styles ─────────────────────────────────────────────────────
function buildStyles() {
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 10, padding: 16,
      borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: { margin: 0, fontSize: 16, fontWeight: 700,
             display: 'flex', alignItems: 'center', gap: 8 },
    countPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: 'rgba(239,68,68,0.18)', color: '#FCA5A5',
    },
    empty: {
      padding: 12, borderRadius: 8, fontSize: 13,
      color: 'rgba(230,244,234,0.65)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
    },
    list: { listStyle: 'none', margin: 0, padding: 0,
            display: 'flex', flexDirection: 'column', gap: 8 },
    row: {
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: 10, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid',
    },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitleLine: { display: 'flex', alignItems: 'center', gap: 8 },
    rowTitle: { fontSize: 14, fontWeight: 600 },
    whyBtn: {
      marginTop: 6, padding: '3px 8px', borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'transparent', color: '#E6F4EA',
      fontSize: 11, cursor: 'pointer',
    },
    expanded: {
      marginTop: 6, padding: 8, borderRadius: 8,
      background: 'rgba(0,0,0,0.2)',
      fontSize: 12, color: 'rgba(230,244,234,0.85)',
    },
    kicker:    { color: '#FCD34D', fontWeight: 600 },
    paragraph: { margin: '0 0 4px 0' },
    dismissBtn: {
      padding: '4px 8px', borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'transparent', color: 'rgba(230,244,234,0.6)',
      cursor: 'pointer', fontSize: 12,
    },
    more: {
      fontSize: 12, color: 'rgba(230,244,234,0.55)',
      textAlign: 'center', padding: 4,
    },
  };
}
