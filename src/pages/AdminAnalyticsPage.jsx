/**
 * Admin Analytics Dashboard — comprehensive farmer metrics view.
 *
 * Sections:
 *   A. Top summary cards (6 KPIs)
 *   B. Farmer Growth (recharts bar chart + period summaries)
 *   C. Onboarding Funnel (horizontal conversion bars)
 *   D. Activity Overview (today's activity by type)
 *   E. Farmer Breakdown (by crop)
 *   F. Alerts / Risk (gap indicators)
 *   G. Recent Activity Feed (timestamped event stream)
 *
 * Data: client-side activityAggregator (localStorage ring buffer).
 * When a server analytics API is connected, swap getFullDashboard() —
 * the UI stays the same.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getFullDashboard, getNewFarmersByDay } from '../services/activityAggregator.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── Event icons & labels ───────────────────────────────────

const EVENT_ICONS = {
  user_registered: '\uD83D\uDC64',
  onboarding_completed: '\u2705',
  farm_created: '\uD83C\uDF31',
  crop_stage_updated: '\uD83D\uDCCA',
  pest_report_submitted: '\uD83D\uDC1B',
  action_completed: '\u2714\uFE0F',
  season_started: '\uD83C\uDF3E',
  login: '\uD83D\uDD11',
};

function eventLabel(type, t) {
  const map = {
    user_registered: t('admin.evtRegistered'),
    onboarding_completed: t('admin.evtOnboarded'),
    farm_created: t('admin.evtFarmCreated'),
    crop_stage_updated: t('admin.evtStageUpdate'),
    pest_report_submitted: t('admin.evtPestReport'),
    action_completed: t('admin.evtActionDone'),
    season_started: t('admin.evtSeasonStart'),
    login: t('admin.evtLogin'),
  };
  return map[type] || type;
}

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatGenderLabel(value, t) {
  const map = {
    male: t('gender.male'),
    female: t('gender.female'),
    other: t('gender.other'),
    prefer_not_to_say: t('gender.preferNotToSay'),
  };
  return map[value] || value;
}

function formatAgeLabel(value, t) {
  const map = {
    under_25: t('age.under_25'),
    '25_34': t('age.25_34'),
    '35_44': t('age.35_44'),
    '45_54': t('age.45_54'),
    '55_plus': t('age.55_plus'),
    prefer_not_to_say: t('age.prefer_not_to_say'),
    // Legacy ranges from OnboardingWizard
    '25_35': t('age.25to35'),
    '36_50': t('age.36to50'),
    over_50: t('age.over50'),
  };
  return map[value] || value;
}

function formatCropName(raw) {
  if (!raw || raw === 'unknown') return 'Unknown';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(14);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setMetrics(getFullDashboard());
    } catch { /* guard UI */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Recharts data — slice to selected range
  const chartData = useMemo(() => {
    if (!metrics) return [];
    const data = chartDays === 30
      ? metrics.newFarmersByDay
      : getNewFarmersByDay(chartDays);
    return data.map(d => ({ ...d, label: d.date.slice(5) }));
  }, [metrics, chartDays]);

  // ─── Loading ────────────────────────────────────────────
  if (loading || !metrics) {
    return (
      <div className="page-body">
        <div className="page-header"><h1>{t('admin.analytics')}</h1></div>
        <p className="loading">{t('admin.loading')}</p>
      </div>
    );
  }

  const { growth, funnel, activityToday, cropBreakdown, risk, genderBreakdown, ageBreakdown, newFarmersByGender, onboardingByAge } = metrics;
  const maxFunnel = Math.max(1, ...funnel.map(s => s.count));

  // ─── A. Summary stat cards ──────────────────────────────
  const statCards = [
    { label: t('admin.totalFarmers'),  value: metrics.totalFarmers,       color: '#22C55E', icon: '\uD83D\uDC65' },
    { label: t('admin.newToday'),      value: metrics.newFarmersToday,    color: '#0891b2', icon: '\uD83C\uDD95' },
    { label: t('admin.activeToday'),   value: metrics.activeFarmersToday, color: '#7c3aed', icon: '\u26A1' },
    { label: t('admin.activeWeek'),    value: metrics.activeFarmersWeek,  color: '#F59E0B', icon: '\uD83D\uDCC5' },
    { label: t('admin.onboardingRate'),value: `${metrics.onboardingRate}%`, color: '#be185d', icon: '\uD83C\uDFAF' },
    { label: t('admin.actionsToday'),  value: activityToday.actionsCompleted, color: '#10B981', icon: '\u2714\uFE0F' },
  ];

  // ─── D. Activity overview items ─────────────────────────
  const activityItems = [
    { label: t('admin.evtStageUpdate'), count: activityToday.stageUpdates, color: '#0891b2', icon: '\uD83D\uDCCA' },
    { label: t('admin.evtPestReport'),  count: activityToday.pestReports,  color: '#EF4444', icon: '\uD83D\uDC1B' },
    { label: t('admin.evtFarmCreated'), count: activityToday.farmsCreated, color: '#22C55E', icon: '\uD83C\uDF31' },
    { label: t('admin.evtActionDone'),  count: activityToday.actionsCompleted, color: '#7c3aed', icon: '\u2714\uFE0F' },
    { label: t('admin.evtLogin'),       count: activityToday.logins,       color: '#F59E0B', icon: '\uD83D\uDD11' },
  ];

  // ─── F. Risk items ──────────────────────────────────────
  const riskItems = [
    { label: t('admin.riskNoFarm'),       count: risk.noFarm,       color: '#F59E0B', icon: '\u26A0\uFE0F' },
    { label: t('admin.riskNotOnboarded'), count: risk.notOnboarded, color: '#FB923C', icon: '\u26A0\uFE0F' },
    { label: t('admin.riskNoPestCheck'),  count: risk.noPestCheck,  color: '#EF4444', icon: '\uD83D\uDD34' },
    { label: t('admin.riskInactive'),     count: risk.inactive,     color: '#A1A1AA', icon: '\u26AA' },
  ];

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {/* Header */}
      <div className="page-header" style={S.header}>
        <h1>{t('admin.analytics')}</h1>
        <button onClick={refresh} className="btn btn-outline btn-sm">{t('admin.refresh')}</button>
      </div>

      {/* ═══ A. Summary Cards ══════════════════════════════ */}
      <div style={S.statsGrid}>
        {statCards.map(c => (
          <div key={c.label} style={S.statCard}>
            <div style={S.statIcon}>{c.icon}</div>
            <div style={{ ...S.statValue, color: c.color }}>{c.value}</div>
            <div style={S.statLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ B + C. Growth Chart + Onboarding Funnel ══════ */}
      <div style={S.twoCol}>
        {/* B. Farmer Growth */}
        <div className="card">
          <div className="card-header" style={S.cardHeaderFlex}>
            <span>{t('admin.farmerGrowth')}</span>
            <div style={S.chipGroup}>
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  style={chartDays === d ? S.chipActive : S.chip}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            {/* Period summaries */}
            <div style={S.growthRow}>
              <div style={S.growthItem}>
                <div style={{ ...S.growthNum, color: '#0891b2' }}>{growth.today}</div>
                <div style={S.growthPeriod}>{t('admin.periodToday')}</div>
              </div>
              <div style={S.growthItem}>
                <div style={{ ...S.growthNum, color: '#7c3aed' }}>{growth.thisWeek}</div>
                <div style={S.growthPeriod}>{t('admin.periodWeek')}</div>
              </div>
              <div style={S.growthItem}>
                <div style={{ ...S.growthNum, color: '#F59E0B' }}>{growth.thisMonth}</div>
                <div style={S.growthPeriod}>{t('admin.periodMonth')}</div>
              </div>
            </div>
            {/* Chart */}
            {chartData.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#A1A1AA', fontSize: 10 }}
                      axisLine={{ stroke: '#243041' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#A1A1AA', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={S.tooltipStyle}
                      labelStyle={{ color: '#94A3B8' }}
                      itemStyle={{ color: '#22C55E' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="count" fill="#22C55E" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* C. Onboarding Funnel */}
        <div className="card">
          <div className="card-header">{t('admin.onboardingFunnel')}</div>
          <div className="card-body">
            {funnel.every(s => s.count === 0) ? (
              <p style={S.muted}>{t('admin.noResults')}</p>
            ) : (
              <div style={S.funnelList}>
                {funnel.map((step, i) => {
                  const pct = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0;
                  const convPct = i === 0 || funnel[0].count === 0
                    ? 100
                    : Math.round((step.count / funnel[0].count) * 100);
                  return (
                    <div key={step.step} style={S.funnelRow}>
                      <div style={S.funnelLabel}>{t(step.label)}</div>
                      <div style={S.funnelBarTrack}>
                        <div style={{ ...S.funnelBar, width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <div style={S.funnelCount}>{step.count}</div>
                      <div style={S.funnelPct}>{convPct}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ D + F. Activity Overview + Risk Alerts ═══════ */}
      <div style={S.twoCol}>
        {/* D. Activity Overview */}
        <div className="card">
          <div className="card-header">{t('admin.activityOverview')}</div>
          <div className="card-body">
            <div style={S.actGrid}>
              {activityItems.map(item => (
                <div key={item.label} style={S.actItem}>
                  <span style={S.actIcon}>{item.icon}</span>
                  <div>
                    <div style={{ ...S.actCount, color: item.color }}>{item.count}</div>
                    <div style={S.actLabel}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* F. Alerts / Risk */}
        <div className="card">
          <div className="card-header">{t('admin.alertsRisk')}</div>
          <div className="card-body">
            {riskItems.every(r => r.count === 0) ? (
              <div style={S.riskGood}>
                <span style={{ fontSize: '1.5rem' }}>{'\u2705'}</span>
                <span style={S.muted}>{t('admin.noRiskIssues')}</span>
              </div>
            ) : (
              <div style={S.riskList}>
                {riskItems.map(item => (
                  <div key={item.label} style={S.riskRow}>
                    <div style={S.riskLeft}>
                      <span>{item.icon}</span>
                      <span style={S.riskLabel}>{item.label}</span>
                    </div>
                    <div style={{ ...S.riskCount, color: item.count > 0 ? item.color : '#4B5563' }}>
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ E. Farmer Breakdown (by crop) ════════════════ */}
      {cropBreakdown.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">{t('admin.cropBreakdown')}</div>
          <div className="card-body">
            <div style={S.cropGrid}>
              {cropBreakdown.map(({ crop, count }) => {
                const maxCrop = Math.max(1, cropBreakdown[0]?.count || 1);
                const pct = (count / maxCrop) * 100;
                return (
                  <div key={crop} style={S.cropRow}>
                    <div style={S.cropName}>{formatCropName(crop)}</div>
                    <div style={S.cropBarTrack}>
                      <div style={{ ...S.cropBar, width: `${Math.max(4, pct)}%` }} />
                    </div>
                    <div style={S.cropCount}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Demographics: Gender + Age Range ═════════════ */}
      {(genderBreakdown.length > 0 || ageBreakdown.length > 0) && (
        <div style={S.twoCol}>
          {/* Gender breakdown */}
          {genderBreakdown.length > 0 && (
            <div className="card">
              <div className="card-header">{t('admin.byGender')}</div>
              <div className="card-body">
                <div style={S.demoBarList}>
                  {genderBreakdown.map(({ gender, count }) => {
                    const maxG = Math.max(1, genderBreakdown[0]?.count || 1);
                    const pct = (count / maxG) * 100;
                    return (
                      <div key={gender} style={S.cropRow}>
                        <div style={S.cropName}>{formatGenderLabel(gender, t)}</div>
                        <div style={S.cropBarTrack}>
                          <div style={{ ...S.genderBar, width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div style={S.cropCount}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Age range breakdown */}
          {ageBreakdown.length > 0 && (
            <div className="card">
              <div className="card-header">{t('admin.byAgeRange')}</div>
              <div className="card-body">
                <div style={S.demoBarList}>
                  {ageBreakdown.map(({ ageGroup, count }) => {
                    const maxA = Math.max(1, ageBreakdown[0]?.count || 1);
                    const pct = (count / maxA) * 100;
                    return (
                      <div key={ageGroup} style={S.cropRow}>
                        <div style={S.cropName}>{formatAgeLabel(ageGroup, t)}</div>
                        <div style={S.cropBarTrack}>
                          <div style={{ ...S.ageBar, width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div style={S.cropCount}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ New Farmers by Gender + Onboarding by Age ════ */}
      {(newFarmersByGender.length > 0 || onboardingByAge.length > 0) && (
        <div style={S.twoCol}>
          {/* New farmers today by gender */}
          {newFarmersByGender.length > 0 && (
            <div className="card">
              <div className="card-header">{t('admin.newByGender')}</div>
              <div className="card-body">
                <div style={S.demoBarList}>
                  {newFarmersByGender.map(({ gender, count }) => {
                    const maxG = Math.max(1, newFarmersByGender[0]?.count || 1);
                    const pct = (count / maxG) * 100;
                    return (
                      <div key={gender} style={S.cropRow}>
                        <div style={S.cropName}>{formatGenderLabel(gender, t)}</div>
                        <div style={S.cropBarTrack}>
                          <div style={{ ...S.genderBar, width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div style={S.cropCount}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Onboarding completions by age range */}
          {onboardingByAge.length > 0 && (
            <div className="card">
              <div className="card-header">{t('admin.onboardingByAge')}</div>
              <div className="card-body">
                <div style={S.demoBarList}>
                  {onboardingByAge.map(({ ageGroup, completed }) => {
                    const maxA = Math.max(1, ...onboardingByAge.map(a => a.completed));
                    const pct = (completed / maxA) * 100;
                    return (
                      <div key={ageGroup} style={S.cropRow}>
                        <div style={S.cropName}>{formatAgeLabel(ageGroup, t)}</div>
                        <div style={S.cropBarTrack}>
                          <div style={{ ...S.ageBar, width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div style={S.cropCount}>{completed}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ G. Recent Activity Feed ══════════════════════ */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">{t('admin.recentActivity')}</div>
        <div className="card-body">
          {metrics.recentActivity.length === 0 ? (
            <p style={S.muted}>{t('admin.noResults')}</p>
          ) : (
            <div style={S.feedList}>
              {metrics.recentActivity.map((e, i) => (
                <div key={i} style={S.feedItem}>
                  <div style={S.feedLeft}>
                    <span style={S.feedIcon}>{EVENT_ICONS[e.event_type] || '\u2022'}</span>
                    <div>
                      <div style={S.feedEvent}>{eventLabel(e.event_type, t)}</div>
                      {e.user_id && <span style={S.feedChip}>{e.user_id.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <div style={S.feedTime}>{timeAgo(e.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const S = {
  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // A. Stat cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '0.625rem',
    marginTop: '0.75rem',
  },
  statCard: {
    background: '#162033',
    border: '1px solid #243041',
    borderRadius: '8px',
    padding: '0.875rem 0.75rem',
    textAlign: 'center',
    transition: 'border-color 0.2s',
  },
  statIcon: {
    fontSize: '1.25rem',
    marginBottom: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.6875rem',
    color: '#A1A1AA',
    marginTop: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    lineHeight: 1.3,
  },

  // Two-column responsive layout
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },

  // Card header with controls
  cardHeaderFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Date chips
  chipGroup: {
    display: 'flex',
    gap: '4px',
  },
  chip: {
    background: 'transparent',
    border: '1px solid #243041',
    borderRadius: '6px',
    padding: '2px 8px',
    fontSize: '0.6875rem',
    color: '#A1A1AA',
    cursor: 'pointer',
  },
  chipActive: {
    background: '#22C55E',
    border: '1px solid #22C55E',
    borderRadius: '6px',
    padding: '2px 8px',
    fontSize: '0.6875rem',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // B. Growth
  growthRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.25rem',
  },
  growthItem: {
    flex: 1,
    textAlign: 'center',
    padding: '0.5rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  growthNum: {
    fontSize: '1.375rem',
    fontWeight: 700,
  },
  growthPeriod: {
    fontSize: '0.6875rem',
    color: '#A1A1AA',
    marginTop: '2px',
    textTransform: 'uppercase',
  },
  tooltipStyle: {
    background: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontSize: '0.75rem',
  },

  // C. Funnel
  funnelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  funnelRow: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 36px 40px',
    alignItems: 'center',
    gap: '0.5rem',
  },
  funnelLabel: {
    fontSize: '0.75rem',
    color: '#E2E8F0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  funnelBarTrack: {
    height: '18px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #22C55E, #10B981)',
    borderRadius: '4px',
    transition: 'width 0.4s ease',
    minWidth: '2px',
  },
  funnelCount: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  funnelPct: {
    fontSize: '0.6875rem',
    color: '#A1A1AA',
    textAlign: 'right',
  },

  // D. Activity
  actGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '0.75rem',
  },
  actItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid #243041',
  },
  actIcon: {
    fontSize: '1.25rem',
  },
  actCount: {
    fontSize: '1.125rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  actLabel: {
    fontSize: '0.625rem',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },

  // F. Risk
  riskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  riskRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.625rem 0.75rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid #243041',
  },
  riskLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  riskLabel: {
    fontSize: '0.8125rem',
    color: '#E2E8F0',
  },
  riskCount: {
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  riskGood: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    justifyContent: 'center',
  },

  // E. Crop breakdown
  cropGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cropRow: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 40px',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cropName: {
    fontSize: '0.8125rem',
    color: '#E2E8F0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cropBarTrack: {
    height: '14px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  cropBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #0891b2, #06B6D4)',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  cropCount: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#FFFFFF',
    textAlign: 'right',
  },

  // G. Feed
  muted: {
    color: '#A1A1AA',
    fontSize: '0.875rem',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  feedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  feedLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
  },
  feedIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  feedEvent: {
    fontSize: '0.8125rem',
    color: '#FFFFFF',
  },
  feedChip: {
    fontSize: '0.625rem',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px',
    padding: '1px 5px',
    color: '#A1A1AA',
    fontFamily: 'monospace',
  },
  feedTime: {
    fontSize: '0.6875rem',
    color: '#A1A1AA',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Demographics
  demoBarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  genderBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c3aed, #A78BFA)',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  ageBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
};
