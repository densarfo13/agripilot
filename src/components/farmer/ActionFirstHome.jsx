/**
 * ActionFirstHome — farmer home layout that leads with today's
 * action and pushes progress stats below.
 *
 * Sections, in order:
 *   1. Primary Task Card   — top action, why, eta, mark-complete
 *   2. Secondary Tasks     — up next list
 *   3. Risk Alerts         — overdue / issues / missed window
 *   4. Progress Summary    — tasks done, active cycles (lower)
 *   5. Crop Stage Card     — current cycle lifecycle
 *   6. Motivation Card     — soft encouragement
 *   7. Support Section     — support card (localized)
 *
 * Data comes from the Today feed (/api/v2/farmer/today) — the
 * component is purely rendering; the page that hosts it fetches.
 */
import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import {
  localizeTaskTitle,
  localizeTaskDetail,
  localizeTaskEta,
  localizeRiskAlert,
} from '../../lib/taskWording.js';
import { completeCycleTask } from '../../hooks/useCropCycles.js';
import SupportCard from '../SupportCard.jsx';

export default function ActionFirstHome({ today, progress, cropStage, onTaskCompleted }) {
  const { t } = useTranslation();

  const primary = today?.topTasks?.[0] || null;
  const secondary = (today?.topTasks || []).slice(1, 3);
  const riskAlerts = buildRiskAlerts({ today, t });

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 1. Primary Task Card */}
        <PrimaryTaskCard
          task={primary}
          t={t}
          onCompleted={onTaskCompleted}
        />

        {/* 2. Secondary Tasks */}
        <Section title={t('actionHome.secondary.title')}>
          {secondary.length === 0 ? (
            <p style={S.muted}>{t('actionHome.secondary.empty')}</p>
          ) : (
            <ul style={S.list}>
              {secondary.map((task) => (
                <li key={task.id} style={S.item}>
                  <div style={S.itemTitle}>{localizeTaskTitle(task, t)}</div>
                  {localizeTaskDetail(task, t) && (
                    <div style={S.itemDetail}>{localizeTaskDetail(task, t)}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 3. Risk Alerts */}
        <Section title={t('actionHome.risks.title')} accent="#F59E0B">
          {riskAlerts.length === 0 ? (
            <p style={S.muted}>{t('actionHome.risks.none')}</p>
          ) : (
            <ul style={S.alertList}>
              {riskAlerts.map((r, i) => (
                <li key={i} style={S.alertItem}>
                  <span style={S.alertDot} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 4. Progress Summary (intentionally lower) */}
        <Section title={t('actionHome.progress.title')}>
          <div style={S.progressGrid}>
            <Stat label={t('actionHome.progress.tasksDone')}    value={progress?.tasksDone ?? 0} />
            <Stat label={t('actionHome.progress.cyclesActive')} value={progress?.cyclesActive ?? 0} />
          </div>
        </Section>

        {/* 5. Crop Stage Card */}
        <Section title={t('actionHome.stage.title')}>
          {cropStage ? (
            <div style={S.stageRow}>
              <span style={S.stageLabel}>{t(`cropStage.${cropStage.stage || 'planting'}`)}</span>
              {cropStage.cropName && <span style={S.stageCrop}>• {cropStage.cropName}</span>}
            </div>
          ) : (
            <p style={S.muted}>{t('actionHome.stage.none')}</p>
          )}
        </Section>

        {/* 6. Motivation Card */}
        <div style={S.motivation}>
          <h3 style={S.motivationTitle}>{t('actionHome.motivation.title')}</h3>
          <p style={S.motivationBody}>{t('actionHome.motivation.body')}</p>
        </div>

        {/* 7. Support Section */}
        <SupportCard />
      </div>
    </div>
  );
}

function PrimaryTaskCard({ task, t, onCompleted }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleComplete() {
    if (!task || busy) return;
    setBusy(true); setErr(null);
    try {
      await completeCycleTask(task.id);
      onCompleted?.(task);
    } catch (e) {
      setErr(e?.code || 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!task) {
    return (
      <div style={S.primaryEmpty}>
        <div style={S.primaryEmptyIcon}>{'\u2728'}</div>
        <h2 style={S.primaryEmptyTitle}>{t('actionHome.primary.noTask')}</h2>
        <p style={S.primaryEmptyBody}>{t('actionHome.primary.noTaskHint')}</p>
      </div>
    );
  }

  const title = localizeTaskTitle(task, t);
  const why = localizeTaskDetail(task, t);
  const eta = localizeTaskEta(task, t);

  return (
    <div style={S.primary}>
      <div style={S.primaryLabel}>{t('actionHome.primary.title')}</div>
      <h2 style={S.primaryTitle}>{title}</h2>

      {why && (
        <div style={S.whyRow}>
          <div style={S.whyLabel}>{t('actionHome.primary.why')}</div>
          <div style={S.whyBody}>{why}</div>
        </div>
      )}

      <div style={S.etaRow}>
        <span style={S.etaIcon}>{'\u23F1\uFE0F'}</span>
        <span style={S.etaLabel}>{t('actionHome.primary.eta')}:</span>
        <span style={S.etaValue}>{eta}</span>
      </div>

      {err && <div style={S.err}>{t('issue.err.generic')}</div>}

      <button
        type="button"
        onClick={handleComplete}
        disabled={busy}
        style={{ ...S.cta, ...(busy ? S.ctaBusy : null) }}
        data-testid="primary-task-complete"
      >
        {busy ? t('actionHome.primary.markingDone') : t('actionHome.primary.markComplete')}
      </button>
    </div>
  );
}

function Section({ title, accent, children }) {
  return (
    <section style={S.section}>
      <h3 style={{ ...S.sectionTitle, color: accent || '#EAF2FF' }}>{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function buildRiskAlerts({ today, t }) {
  if (!today) return [];
  const alerts = [];
  if (today.overdueTasksCount > 0) {
    alerts.push(t('actionHome.risks.overdueCount', { n: today.overdueTasksCount }));
  }
  if (today.openHighRiskIssues > 0) {
    alerts.push(localizeRiskAlert('open_high_severity_issue', t));
  }
  if (today.nextAction && /catch up/i.test(today.nextAction)) {
    alerts.push(localizeRiskAlert('overdue', t));
  }
  return Array.from(new Set(alerts));
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },

  // Primary task card
  primary: {
    padding: '1.25rem',
    borderRadius: '20px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.22)',
    boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
  },
  primaryEmpty: {
    padding: '1.5rem',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  },
  primaryEmptyIcon: { fontSize: '2rem', marginBottom: '0.5rem' },
  primaryEmptyTitle: { fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem' },
  primaryEmptyBody: { fontSize: '0.9375rem', color: '#9FB3C8', margin: 0 },
  primaryLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#22C55E',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: '0.375rem',
  },
  primaryTitle: { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.625rem', lineHeight: 1.3 },
  whyRow: {
    padding: '0.625rem 0.75rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    marginBottom: '0.625rem',
  },
  whyLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.125rem',
  },
  whyBody: { fontSize: '0.875rem', lineHeight: 1.4 },
  etaRow: {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.8125rem', color: '#9FB3C8', marginBottom: '0.75rem',
  },
  etaIcon: { fontSize: '1rem' },
  etaLabel: { color: '#6F8299' },
  etaValue: { color: '#EAF2FF', fontWeight: 600 },
  cta: {
    width: '100%', padding: '0.875rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  ctaBusy: { opacity: 0.7, cursor: 'wait' },
  err: { color: '#FCA5A5', fontSize: '0.8125rem', marginBottom: '0.5rem' },

  // Sections
  section: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  itemTitle: { fontSize: '0.9375rem', fontWeight: 600 },
  itemDetail: { fontSize: '0.8125rem', color: '#9FB3C8', marginTop: '0.125rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },

  // Risk alerts
  alertList: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  alertItem: {
    display: 'flex', gap: '0.5rem', alignItems: 'center',
    fontSize: '0.875rem', padding: '0.375rem 0',
  },
  alertDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#F59E0B', flexShrink: 0,
  },

  // Progress grid
  progressGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' },
  stat: { padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  statValue: { fontSize: '1.25rem', fontWeight: 700 },
  statLabel: { fontSize: '0.6875rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },

  // Stage row
  stageRow: { fontSize: '0.9375rem', color: '#EAF2FF' },
  stageLabel: { fontWeight: 700 },
  stageCrop: { color: '#9FB3C8', marginLeft: '0.375rem' },

  // Motivation
  motivation: {
    padding: '1rem 1.125rem',
    borderRadius: '16px',
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.2)',
  },
  motivationTitle: { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#0EA5E9' },
  motivationBody: { fontSize: '0.875rem', color: '#EAF2FF', margin: 0, lineHeight: 1.5 },
};
