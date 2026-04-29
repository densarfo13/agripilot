/**
 * AgentDashboard — primary surface for the v3 Field Agent
 * Mode (role: 'agent').
 *
 *   <Route path="/agent" element={<AgentDashboard />} />
 *
 * Sections (per spec § 2)
 *   1. My Farmers   — only farmers this agent created
 *   2. Add Farmer   — onboarding form (queues to sync)
 *   3. Activity Log — visits + farmer-creations on this device
 *
 * Sync behaviour
 *   * scheduleAutoSync runs syncQueue() every 30 s while
 *     navigator.onLine === true (per spec § 5).
 *   * Resumes immediately on the 'online' event so an
 *     agent who walks back into signal doesn't wait the
 *     full interval.
 *
 * Strict-rule audit
 *   * Local-first — every section reads the agentQueue
 *     projection. The page is fully functional offline;
 *     sync is a separate background concern.
 *   * "Assigned Farmers" filter (spec § 6) — the My
 *     Farmers section only surfaces rows where
 *     `agentId === currentUser.sub`.
 *   * Defensive: an agent with NO farmers, NO visits, and
 *     NO active queue lands on a calm "Get started" empty
 *     state, never an error.
 *   * No PII leaks — phone numbers are visible to the
 *     owning agent only (this is their book of contacts).
 *     Other agents using the same role + role-gated route
 *     see only their own data because of the agentId
 *     filter.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext.jsx';
import {
  getMyFarmers, getActivityLog, agentSummary,
  scheduleAutoSync, syncQueue,
  AGENT_ACTIONS, AGENT_QUEUE_STATUS,
  addToQueue,
} from '../offline/agentQueue.js';
import AddFarmerForm from '../components/agent/AddFarmerForm.jsx';
import { tSafe }      from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo      from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;
const SECTIONS = [
  { key: 'farmers',  labelKey: 'agent.tabFarmers',  fallback: 'My Farmers' },
  { key: 'add',      labelKey: 'agent.tabAdd',      fallback: 'Add Farmer' },
  { key: 'log',      labelKey: 'agent.tabActivity', fallback: 'Activity Log' },
];

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agentId = user?.sub || null;

  const [tab, setTab] = useState('farmers');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Background sync — kicks off immediately + every 30 s
  // while online.
  useEffect(() => {
    const stop = scheduleAutoSync({ intervalMs: 30 * 1000 });
    return () => { stop(); };
  }, []);

  // Online status banner
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  );
  useEffect(() => {
    function on()  { setOnline(true);  refresh(); }
    function off() { setOnline(false); }
    if (typeof window !== 'undefined') {
      window.addEventListener('online',  on);
      window.addEventListener('offline', off);
      return () => {
        window.removeEventListener('online',  on);
        window.removeEventListener('offline', off);
      };
    }
    return undefined;
  }, []);

  const summary  = useMemo(() => agentSummary(agentId),       [agentId, tick]);
  const farmers  = useMemo(() => getMyFarmers(agentId),       [agentId, tick]);
  const activity = useMemo(() => getActivityLog(agentId),     [agentId, tick]);

  function handleSyncNow() {
    syncQueue().then(refresh).catch(refresh);
  }

  function handleLogVisit(farmer) {
    if (!farmer || !farmer.id) return;
    addToQueue({
      action:  AGENT_ACTIONS.LOG_VISIT,
      agentId,
      payload: {
        farmerId: farmer.id,
        farmerName: farmer.name || '',
        notedAt:  new Date().toISOString(),
      },
    });
    refresh();
  }

  return (
    <main style={S.page} data-testid="agent-dashboard">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.h1}>
            {tSafe('agent.dashboardTitle', 'Field agent')}
          </h1>
          <p style={S.lead}>
            {tSafe('agent.dashboardLead',
              'Add farmers in the field. Their details stay on this phone until your network comes back.')}
          </p>
        </header>

        {/* Connection + sync banner */}
        <div
          style={{
            ...S.bannerBase,
            ...(online ? S.bannerOnline : S.bannerOffline),
          }}
          data-testid="agent-connection"
        >
          <span style={S.bannerIcon} aria-hidden="true">
            {online ? '🟢' : '⚪'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.bannerTitle}>
              {online
                ? tSafe('agent.online',  'Online — changes sync automatically')
                : tSafe('agent.offline', 'Offline — saving locally')}
            </div>
            <div style={S.bannerMeta}>
              {summary.pendingSync > 0
                ? `${summary.pendingSync} ${tSafe('agent.pending', 'pending sync')}`
                : tSafe('agent.allSynced', 'All caught up')}
              {summary.syncedCount > 0 && (
                <> · {summary.syncedCount} {tSafe('agent.synced', 'synced')}</>
              )}
            </div>
          </div>
          {online && summary.pendingSync > 0 && (
            <button
              type="button"
              onClick={handleSyncNow}
              style={S.btnPrimary}
              data-testid="agent-sync-now"
            >
              {tSafe('agent.syncNow', 'Sync now')}
            </button>
          )}
        </div>

        {/* Stats strip */}
        <section style={S.stats}>
          <Stat label={tSafe('agent.statFarmers',  'Farmers')}
                value={summary.farmerCount} tone="good" />
          <Stat label={tSafe('agent.statVisits',   'Visits logged')}
                value={summary.visitsLogged} />
          <Stat label={tSafe('agent.statPending',  'Pending sync')}
                value={summary.pendingSync}
                tone={summary.pendingSync > 0 ? 'warn' : 'neutral'} />
        </section>

        {/* Tab strip */}
        <nav style={S.tabBar} data-testid="agent-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              data-testid={`agent-tab-${s.key}`}
              aria-current={tab === s.key ? 'page' : undefined}
              style={{
                ...S.tab,
                ...(tab === s.key ? S.tabActive : {}),
              }}
            >
              {tSafe(s.labelKey, s.fallback)}
            </button>
          ))}
        </nav>

        {tab === 'farmers' && (
          <FarmersSection
            farmers={farmers}
            onLogVisit={handleLogVisit}
            onAdd={() => setTab('add')}
          />
        )}

        {tab === 'add' && (
          <AddFarmerForm
            agentId={agentId}
            onAdded={() => { refresh(); setTab('farmers'); }}
          />
        )}

        {tab === 'log' && (
          <ActivitySection activity={activity} />
        )}
      </div>
    </main>
  );
}

/* ─── Sections ────────────────────────────────────── */

function FarmersSection({ farmers, onLogVisit, onAdd }) {
  if (!farmers || farmers.length === 0) {
    return (
      <section style={S.section} data-testid="agent-farmers-empty">
        <p style={S.emptyTitle}>
          {tSafe('agent.noFarmers',
            'You haven\u2019t added any farmers yet.')}
        </p>
        <p style={S.emptyHint}>
          {tSafe('agent.noFarmersHint',
            'Tap "Add Farmer" to register your first one. Works offline.')}
        </p>
        <button
          type="button"
          onClick={onAdd}
          style={S.btnPrimary}
          data-testid="agent-empty-add"
        >
          + {tSafe('agent.addFarmer', 'Add a farmer')}
        </button>
      </section>
    );
  }
  return (
    <section style={S.section} data-testid="agent-farmers-list">
      <h2 style={S.sectionTitle}>
        {tSafe('agent.myFarmersTitle', 'My farmers')}
      </h2>
      <ul style={S.list}>
        {farmers.map((f) => (
          <li key={f.id} style={S.row}>
            <div style={S.rowHeader}>
              <span style={S.rowName}>{f.name || tSafe('agent.unnamed', 'Unnamed farmer')}</span>
              <span style={S.rowSync}>
                {f.syncedAt
                  ? <span style={S.syncedPill}>✓ {tSafe('agent.synced', 'synced')}</span>
                  : <span style={S.pendingPill}>⏳ {tSafe('agent.pending', 'pending')}</span>}
              </span>
            </div>
            <p style={S.rowMeta}>
              {f.crop || tSafe('agent.cropUnknown', 'crop unknown')}
              {f.farmSize != null && (
                <> · {f.farmSize} {tSafe('agent.haShort', 'ha')}</>
              )}
              {f.region && <> · {f.region}</>}
              {f.gps && <> · 📍 {f.gps.lat.toFixed(2)}, {f.gps.lng.toFixed(2)}</>}
            </p>
            {f.phone && (
              <a href={`tel:${f.phone}`}
                 style={S.rowPhone}
                 data-testid={`agent-call-${f.id}`}>
                📞 {f.phone}
              </a>
            )}
            <div style={S.rowActions}>
              <button
                type="button"
                onClick={() => onLogVisit(f)}
                style={S.btnGhost}
                data-testid={`agent-log-visit-${f.id}`}
              >
                {tSafe('agent.logVisit', 'Log visit')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivitySection({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <section style={S.section} data-testid="agent-activity-empty">
        <p style={S.emptyTitle}>
          {tSafe('agent.noActivity',
            'No activity yet on this device.')}
        </p>
        <p style={S.emptyHint}>
          {tSafe('agent.noActivityHint',
            'Adding a farmer or logging a visit will appear here.')}
        </p>
      </section>
    );
  }
  return (
    <section style={S.section} data-testid="agent-activity-list">
      <h2 style={S.sectionTitle}>
        {tSafe('agent.activityTitle', 'Activity log')}
      </h2>
      <ul style={S.list}>
        {activity.map((a) => (
          <li key={a.id} style={S.activityRow}>
            <div style={S.activityHeader}>
              <span style={S.activityAction}>
                {actionLabel(a.action)}
              </span>
              <span style={statusStyle(a.status)}>
                {a.status}
              </span>
            </div>
            <p style={S.activityMeta}>
              {a.payload?.name && <strong>{a.payload.name}</strong>}
              {a.payload?.farmerName
                && <strong>{a.payload.farmerName}</strong>}
              {' · '}
              {String(a.createdAt || '').replace('T', ' ').slice(0, 16)}
              {a.attempts > 0 && (
                <> · {a.attempts} {tSafe('agent.attempts', 'attempts')}</>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function actionLabel(action) {
  switch (action) {
    case AGENT_ACTIONS.ADD_FARMER:  return tSafe('agent.action.addFarmer',  'Added farmer');
    case AGENT_ACTIONS.UPDATE_FARM: return tSafe('agent.action.updateFarm', 'Updated farm');
    case AGENT_ACTIONS.LOG_VISIT:   return tSafe('agent.action.logVisit',   'Logged visit');
    default:                        return String(action || '').replace('_', ' ');
  }
}

function statusStyle(status) {
  const map = {
    [AGENT_QUEUE_STATUS.PENDING]: { bg: 'rgba(245,158,11,0.18)', fg: '#FCD34D' },
    [AGENT_QUEUE_STATUS.SYNCING]: { bg: 'rgba(59,130,246,0.18)', fg: '#93C5FD' },
    [AGENT_QUEUE_STATUS.SYNCED]:  { bg: 'rgba(34,197,94,0.15)',  fg: C.lightGreen },
    [AGENT_QUEUE_STATUS.FAILED]:  { bg: 'rgba(239,68,68,0.15)',  fg: '#FCA5A5' },
  };
  const s = map[status] || map[AGENT_QUEUE_STATUS.PENDING];
  return {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.15rem 0.5rem', borderRadius: '999px',
    background: s.bg, color: s.fg,
  };
}

function Stat({ label, value, tone = 'neutral' }) {
  const colour =
      tone === 'good' ? C.lightGreen
    : tone === 'warn' ? '#FCD34D'
    :                   C.white;
  return (
    <div style={S.stat}>
      <div style={{ ...S.statValue, color: colour }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '40rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  h1:    { margin: '0.4rem 0 0', fontSize: '1.5rem',
           fontWeight: 800, color: C.white,
           letterSpacing: '-0.01em' },
  lead:  { margin: 0, color: 'rgba(255,255,255,0.7)',
           fontSize: '0.9375rem' },

  bannerBase: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    gap: '0.65rem',
    padding: '0.75rem 0.95rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  bannerOnline:  {
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.30)',
  },
  bannerOffline: {
    background: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.30)',
  },
  bannerIcon:  { fontSize: '0.95rem' },
  bannerTitle: { color: C.white, fontWeight: 800,
                 fontSize: '0.9375rem' },
  bannerMeta:  { color: 'rgba(255,255,255,0.65)',
                 fontSize: '0.8125rem' },

  stats: {
    display: 'grid', gap: '0.6rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
  },
  stat: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  statValue: { fontSize: '1.4rem', fontWeight: 800,
               lineHeight: 1.05 },
  statLabel: { color: 'rgba(255,255,255,0.6)',
               fontSize: '0.78rem',
               textTransform: 'uppercase',
               letterSpacing: '0.06em', fontWeight: 700 },

  tabBar: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
    padding: '0.4rem 0', alignItems: 'center',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.5rem 0.95rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.875rem', fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(34,197,94,0.15)',
    color: C.lightGreen,
    borderColor: 'rgba(34,197,94,0.40)',
  },

  section: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 800,
                  color: C.white, letterSpacing: '-0.005em' },
  list: { listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.7rem 0.85rem',
    display: 'flex', flexDirection: 'column', gap: '0.3rem',
  },
  rowHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.5rem',
  },
  rowName: { color: C.white, fontWeight: 700,
             fontSize: '0.9375rem' },
  rowSync: { display: 'inline-flex' },
  syncedPill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.15rem 0.5rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.15)', color: C.lightGreen,
  },
  pendingPill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.15rem 0.5rem', borderRadius: '999px',
    background: 'rgba(245,158,11,0.18)', color: '#FCD34D',
  },
  rowMeta: { margin: 0, color: 'rgba(255,255,255,0.7)',
             fontSize: '0.8125rem' },
  rowPhone: { color: C.lightGreen, fontWeight: 700,
              textDecoration: 'none', fontSize: '0.875rem' },
  rowActions: { display: 'flex', gap: '0.4rem' },

  activityRow: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.6rem 0.85rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  activityHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.5rem',
  },
  activityAction: { color: C.white, fontWeight: 700,
                    fontSize: '0.875rem' },
  activityMeta:   { margin: 0, color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.8125rem' },

  emptyTitle: { margin: 0, color: C.white,
                fontWeight: 700, fontSize: '0.9375rem' },
  emptyHint:  { margin: 0, color: 'rgba(255,255,255,0.6)',
                fontSize: '0.875rem' },

  btnPrimary: {
    padding: '0.6rem 1.1rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
    flexShrink: 0,
  },
  btnGhost: {
    padding: '0.4rem 0.8rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};
