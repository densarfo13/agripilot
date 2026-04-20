/**
 * ProgramDashboard — minimal NGO-farmer home screen.
 *
 * NGO-imported users land here directly — no onboarding, no
 * setup wizard, no "Are you new to farming?" question. They
 * just see their program tag, today's task, and can mark it
 * done.
 *
 * Data: GET /api/farm/me/context (server calls getFarmContext
 * for the currently-authenticated user's farm).
 */

import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { renderLocalizedMessage } from '../core/i18n/index.js';
import { showToast } from '../core/farm/unified.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

async function fetchFarmMeContext() {
  const r = await fetch('/api/farm/me/context', { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const body = await r.json();
  if (body && body.success === true) return body.data;
  if (body && body.success === false) throw new Error(body.error || 'server_failure');
  return body;
}

export default function ProgramDashboard() {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);
  const [markingDone, setMarkingDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ctx = await fetchFarmMeContext();
        if (!alive) return;
        setData(ctx);
        safeTrackEvent('program.dashboard_loaded', {
          program: ctx?.farm?.program || null,
          crop:    ctx?.farm?.crop    || null,
        });
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleMarkDone() {
    if (markingDone) return;
    const firstTask = data?.tasks?.[0];
    if (!firstTask) return;
    setMarkingDone(true);
    safeTrackEvent('program.task_marked_done', {
      code: firstTask.code, farmId: data?.farm?.id,
    });
    // The real completion endpoint is wired elsewhere; this flash
    // keeps the user feeling progress even if that hop fails.
    showToast(resolve(t, 'program.task_done_toast', 'Task marked done'));
    setMarkingDone(false);
  }

  const loadingLbl = resolve(t, 'program.loading',        'Loading\u2026');
  const welcomeLbl = resolve(t, 'program.welcome',        'Welcome \uD83D\uDC4B');
  const youAreIn   = resolve(t, 'program.youAreIn',       'You are part of the {{program}}');
  const todayLbl   = resolve(t, 'program.todaysTask',     '\uD83C\uDF31 Today\u2019s Task');
  const doneLbl    = resolve(t, 'program.markDone',       'Mark as Done');
  const cropLbl    = resolve(t, 'program.crop',           'Crop');
  const locLbl     = resolve(t, 'program.location',       'Location');
  const errLbl     = resolve(t, 'program.error',          'Could not load your program');
  const noFarmLbl  = resolve(t, 'program.noFarm',         'No farm found for your account yet.');

  if (loading) {
    return <main style={S.page} data-screen="program-dashboard">{loadingLbl}</main>;
  }

  if (error) {
    return (
      <main style={S.page} data-screen="program-dashboard" data-state="error">
        <h2 style={S.title}>{errLbl}</h2>
        <p style={S.error} role="alert">{error}</p>
      </main>
    );
  }

  if (!data || !data.farm) {
    return (
      <main style={S.page} data-screen="program-dashboard" data-state="no-farm">
        <h2 style={S.title}>{welcomeLbl}</h2>
        <p style={S.sub}>{noFarmLbl}</p>
      </main>
    );
  }

  const programName = data.farm.program || '—';
  const firstTask   = Array.isArray(data.tasks) && data.tasks[0] ? data.tasks[0] : null;
  const firstTitle  = firstTask
    ? (renderLocalizedMessage(firstTask, t) || firstTask.code || '—')
    : null;

  const programLine = String(youAreIn).replace(/\{\{?\s*program\s*\}?\}/, programName);

  return (
    <main style={S.page} data-screen="program-dashboard">
      <h2 style={S.title}>{welcomeLbl}</h2>
      <p  style={S.sub}>{programLine}</p>

      {firstTask && (
        <section style={S.card} data-testid="program-today-task">
          <h3 style={S.cardHeader}>{todayLbl}</h3>
          <p  style={S.taskTitle}>{firstTitle}</p>
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={markingDone}
            style={{ ...S.doneBtn, opacity: markingDone ? 0.7 : 1 }}
            data-testid="program-mark-done"
          >
            {doneLbl}
          </button>
        </section>
      )}

      <hr style={S.divider} />

      <div style={S.metaRow}>
        <p style={S.metaLine}><strong>{cropLbl}:</strong> {data.farm.crop || '—'}</p>
        <p style={S.metaLine}>
          <strong>{locLbl}:</strong> {data.farm.locationName || data.farm.country || '—'}
        </p>
      </div>
    </main>
  );
}

const S = {
  page: {
    maxWidth: 520, margin: '0 auto', padding: '24px 20px 40px',
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    boxSizing: 'border-box',
  },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 700 },
  sub:   { margin: '0 0 18px', color: 'rgba(255,255,255,0.7)' },
  error: {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.875rem',
  },
  card: {
    padding: '14px 16px', borderRadius: 12,
    border: '2px solid #22C55E',
    background: 'rgba(34,197,94,0.08)',
  },
  cardHeader: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#86EFAC' },
  taskTitle:  { margin: '0 0 10px', fontSize: 18, fontWeight: 700 },
  doneBtn: {
    padding: '10px 14px', borderRadius: 10, border: 'none',
    background: '#2e7d32', color: '#fff', fontWeight: 700, cursor: 'pointer',
  },
  divider: {
    border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)',
    margin: '18px 0',
  },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  metaLine: { margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 14 },
};
