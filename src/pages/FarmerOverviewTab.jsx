import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useFarmerContext } from './FarmerHomePage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import api from '../api/client.js';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import EngagementStrip from '../components/engagement/EngagementStrip.jsx';
import NgoModeCard from '../components/monetization/NgoModeCard.jsx';
import InsightsDigest from '../components/insights/InsightsDigest.jsx';
import InviteFriendsCard from '../components/growth/InviteFriendsCard.jsx';
import SellPromptCard from '../components/growth/SellPromptCard.jsx';
import MarketSwitcherChip from '../components/markets/MarketSwitcherChip.jsx';
import HomeTaskEnhancer from '../components/home/HomeTaskEnhancer.jsx';
// Final go-live spec §9: empty-state when no recommendations.
import AllSetForTodayCard from '../components/home/AllSetForTodayCard.jsx';
import StreakRewardBanner from '../components/engagement/StreakRewardBanner.jsx';
import ProfileCompletionPrompt from '../components/home/ProfileCompletionPrompt.jsx';
import MarketplaceNudgeCard from '../components/home/MarketplaceNudgeCard.jsx';
import SignInPromptCard from '../components/home/SignInPromptCard.jsx';
import WaitlistNudgeCard from '../components/home/WaitlistNudgeCard.jsx';
import HomeHeader from '../components/home/HomeHeader.jsx';
import { isFeatureEnabled } from '../config/features.js';

const STAGE_META = {
  pre_planting: { label: 'Pre-Planting', color: '#6b7280', emoji: '\u{1F331}' },
  planting: { label: 'Planting', color: '#16a34a', emoji: '\u{1F33E}' },
  vegetative: { label: 'Vegetative', color: '#059669', emoji: '\u{1F33F}' },
  flowering: { label: 'Flowering', color: '#d97706', emoji: '\u{1F33B}' },
  harvest: { label: 'Harvest', color: '#ea580c', emoji: '\u{1F33D}' },
  post_harvest: { label: 'Post-Harvest', color: '#7c3aed', emoji: '\u{1F4E6}' },
};

export default function FarmerOverviewTab() {
  const { lang } = useTranslation();
  const { farmer, summary, reminderSummary, unread, farmerId, refresh } = useFarmerContext();
  const navigate = useNavigate();
  const recentApps = farmer?.applications?.slice(0, 5) || [];
  const [lifecycle, setLifecycle] = useState(null);
  const [lcLoading, setLcLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [lcSuccess, setLcSuccess] = useState('');
  const [lcError, setLcError] = useState('');

  useEffect(() => {
    api.get(`/lifecycle/farmers/${farmerId}`)
      .then(r => setLifecycle(r.data))
      .catch(() => {}) // lifecycle is supplemental — page shows "Unable to load" when null
      .finally(() => setLcLoading(false));
  }, [farmerId]);

  const handleRecompute = async () => {
    setRecomputing(true);
    setLcError('');
    setLcSuccess('');
    const previousStage = lifecycle?.currentStage || null;
    try {
      await api.post(`/lifecycle/farmers/${farmerId}/recompute`);
      const r = await api.get(`/lifecycle/farmers/${farmerId}`);
      setLifecycle(r.data);
      refresh();
      // Spec §5: motivating completion feedback. Show whether the
      // stage advanced and acknowledge the user's effort either way.
      const nextStageMeta = STAGE_META[r.data?.currentStage];
      const nextLabel = nextStageMeta?.label || r.data?.currentStage?.replace(/_/g, ' ') || '';
      const advanced = previousStage && r.data?.currentStage && previousStage !== r.data.currentStage;
      setLcSuccess(
        advanced
          ? `Great work — you're now in ${nextLabel}.`
          : nextLabel
            ? `Progress updated. Keep going in ${nextLabel}.`
            : 'Progress updated. Great work.',
      );
      setTimeout(() => setLcSuccess(''), 5000);
    } catch {
      setLcError('Failed to update progress. Please try again.');
    }
    setRecomputing(false);
  };

  const handleGenerateReminders = async () => {
    setLcError('');
    try {
      const r = await api.post(`/lifecycle/farmers/${farmerId}/generate-reminders`);
      setLcSuccess(`Generated ${r.data.generated} reminder${r.data.generated === 1 ? '' : 's'} for ${lifecycle?.currentStage?.replace(/_/g, ' ')} stage.`);
      setTimeout(() => setLcSuccess(''), 5000);
      refresh();
    } catch {
      setLcError('Failed to generate reminders. Please try again.');
    }
  };

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {/* UI polish §3: unified greeting + streak header at the
          very top. Self-hides when `uiPolish` flag is off. */}
      <HomeHeader name={farmer?.fullName || farmer?.firstName || ''} />
      {/* Funnel optimisation §5: optional sign-in nudge. Only
          renders AFTER first action — never before value. */}
      <SignInPromptCard />
      {/* Funnel optimisation §8: marketplace nudge with demand +
          suggested price + List now. Self-hides when no demand
          signal or the user already has a listing. */}
      <MarketplaceNudgeCard />
      {/* Robust journey §5 + §7: complement to the marketplace
          nudge — when there is NO demand for the user's crop,
          surface a calm "notify me / boost listing" alternative
          instead of leaving the slot empty. */}
      <WaitlistNudgeCard />
      {/* Onboarding optimisation §6: prompt to fill in the deferred
          farm size + crop stage fields. Self-hides when the user
          completed the full form, when neither field is missing,
          or when `onboardingV2` is off. */}
      <ProfileCompletionPrompt />
      {/* Multi-market expansion §5: market switcher chip. Auto-
          detects from country, allows manual override. Self-hides
          when `multiMarket` flag is off. */}
      <MarketSwitcherChip />
      {/* Daily streak system §4 + §6: milestone celebration on
          3/7/14/30 OR streak-at-risk warning when no completion
          yet today (after 4pm local). Self-suppresses when
          `streakRewards` is off and when neither condition fires. */}
      <StreakRewardBanner />
      {/* Daily engagement layer (flag-gated; returns null when off) */}
      <EngagementStrip />
      {/* Long-term moat: insights digest pulled from accumulated
          data (flag-gated; returns null when no insights yet). */}
      <InsightsDigest farmerId={farmerId} />
      {/* User growth §3: prompt eligible users to list their
          produce. Self-suppresses when conditions aren't met. */}
      <SellPromptCard farmerId={farmerId} />
      {/* User growth §2 + §5: invite friends (region-focused
          headline). Captures incoming ?ref=CODE on mount. */}
      <InviteFriendsCard />
      {/* NGO mode card (flag-gated; returns null when off) */}
      <NgoModeCard />
      {/* Lifecycle Stage Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Lifecycle Stage</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={handleGenerateReminders} disabled={lcLoading || !lifecycle}>
              Generate Reminders
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.45)', color: '#86EFAC', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', padding: '0.35rem 0.75rem', borderRadius: '8px' }}
              onClick={handleRecompute}
              disabled={recomputing || lcLoading}
              title="Confirm you've completed your current stage activities so we update your progress"
            >
              {recomputing ? 'Updating…' : '✓ Mark as done'}
            </button>
          </div>
        </div>
        <div className="card-body">
          {lcError && (
            <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>{lcError}</div>
          )}
          {lcSuccess && (
            <div className="alert-inline alert-inline-success" style={{ marginBottom: '0.75rem' }}>{lcSuccess}</div>
          )}
          {lcLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#71717A' }}>Loading lifecycle...</div>
          ) : lifecycle ? (
            <>
              {/* Stage progress bar */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '1rem' }}>
                {(lifecycle.stages || Object.keys(STAGE_META)).map((stage, i) => {
                  const meta = STAGE_META[stage];
                  const isCurrent = stage === lifecycle.currentStage;
                  const isPast = i < lifecycle.stageIndex;
                  return (
                    <div key={stage} style={{
                      flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem',
                      background: isCurrent ? meta.color : isPast ? `${meta.color}22` : '#1E293B',
                      color: isCurrent ? '#FFFFFF' : isPast ? meta.color : '#9ca3af',
                      borderRadius: i === 0 ? '6px 0 0 6px' : i === 5 ? '0 6px 6px 0' : '0',
                      fontSize: '0.7rem', fontWeight: isCurrent ? 700 : 400,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: '1rem' }}>{meta.emoji}</div>
                      {meta.label}
                    </div>
                  );
                })}
              </div>

              {/* Current stage detail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Current Stage</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: STAGE_META[lifecycle.currentStage]?.color }}>
                    {STAGE_META[lifecycle.currentStage]?.emoji} {STAGE_META[lifecycle.currentStage]?.label || lifecycle.currentStage}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Crop</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{lifecycle.cropType ? getCropLabelSafe(lifecycle.cropType, lang) : 'Not set'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Trust Status</div>
                  {(() => {
                    const conf = lifecycle.stageConfidence;
                    const map = {
                      high: { label: 'Validated', cls: 'badge-approved', hint: 'Confirmed by recent farmer activity' },
                      medium: { label: 'Needs Verification', cls: 'badge-submitted', hint: 'Stage inferred — visit or ask farmer to confirm' },
                      low: { label: 'Low Confidence', cls: 'badge-draft', hint: 'Not enough data — log activities to improve' },
                    };
                    const m = map[conf] || { label: conf || 'Unknown', cls: 'badge-draft', hint: '' };
                    return (
                      <>
                        <span className={`badge ${m.cls}`}>{m.label}</span>
                        {m.hint && <div style={{ fontSize: '0.72rem', color: '#A1A1AA', marginTop: '0.2rem', lineHeight: 1.3 }}>{m.hint}</div>}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Source</div>
                  <span className="text-sm">{lifecycle.stageSource === 'activity' ? 'Farmer activities' : lifecycle.stageSource === 'seeded' ? 'Demo data' : lifecycle.stageSource?.replace(/_/g, ' ') || 'N/A'}</span>
                </div>
              </div>

              {/* Last activity and reason */}
              {lifecycle.reason && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#1E293B', borderRadius: '4px', fontSize: '0.8rem', color: '#A1A1AA' }}>
                  {lifecycle.reason}
                </div>
              )}

              {/* Recommendations — empty branch shows the
                  "all set for today" empty state with a Scan
                  shortcut (final go-live spec §9). */}
              {(!lifecycle.recommendations || lifecycle.recommendations.length === 0) && (
                <AllSetForTodayCard />
              )}
              {lifecycle.recommendations && lifecycle.recommendations.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Today’s Priority</div>
                  {isFeatureEnabled('homeTaskV2') ? (
                    /* V2 surface: motivating progress line, urgency
                       chips, benefit text, and prominent Listen
                       button. Replaces the bare bulleted list. */
                    <HomeTaskEnhancer
                      recommendations={lifecycle.recommendations}
                      currentStageLabel={STAGE_META[lifecycle.currentStage]?.label || lifecycle.currentStage}
                      progressPct={(() => {
                        const list = lifecycle.stages || Object.keys(STAGE_META);
                        const idx = Number(lifecycle.stageIndex);
                        if (!Number.isFinite(idx) || !list.length) return 0;
                        return Math.round((idx / Math.max(1, list.length - 1)) * 100);
                      })()}
                      lang={lang}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {lifecycle.recommendations.slice(0, 4).map((rec, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>-</span>
                          <div>
                            <span style={{ fontWeight: 500 }}>{rec.title}</span>
                            <span style={{ color: '#A1A1AA', marginLeft: '0.5rem' }}>{rec.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#71717A' }}>Unable to load lifecycle data</div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Activities This Month</div>
          <div className="stat-value">{summary?.thisMonthCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Reminders</div>
          <div className="stat-value" style={{ color: (reminderSummary?.overdue || 0) > 0 ? '#dc2626' : undefined }}>
            {reminderSummary?.pending || 0}
            {reminderSummary?.overdue > 0 && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginLeft: '0.5rem' }}>({reminderSummary.overdue} overdue)</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unread Notifications</div>
          <div className="stat-value">{unread}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Applications</div>
          <div className="stat-value">{farmer?.applications?.length || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Upcoming reminders */}
        <div className="card">
          <div className="card-header">
            Upcoming Reminders
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/farmer-home/${farmerId}/reminders`)}>View All</button>
          </div>
          <div className="card-body" style={{ padding: reminderSummary?.upcoming?.length ? 0 : undefined }}>
            {reminderSummary?.upcoming?.length > 0 ? (
              <table>
                <tbody>
                  {reminderSummary.upcoming.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.title}</td>
                      <td className="text-sm text-muted">{new Date(r.dueDate).toLocaleDateString()}</td>
                      <td><span className={`badge badge-${r.reminderType}`}>{r.reminderType?.replace(/_/g, ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState icon="✅" title="No upcoming reminders" compact />
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            Recent Activity
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/farmer-home/${farmerId}/activities`)}>View All</button>
          </div>
          <div className="card-body" style={{ padding: summary?.recentActivities?.length ? 0 : undefined }}>
            {summary?.recentActivities?.length > 0 ? (
              <table>
                <tbody>
                  {summary.recentActivities.map(a => (
                    <tr key={a.id}>
                      <td><span className={`badge badge-${a.activityType}`}>{a.activityType?.replace(/_/g, ' ')}</span></td>
                      <td>{a.cropType ? getCropLabelSafe(a.cropType, lang) : '-'}</td>
                      <td className="text-sm text-muted">{new Date(a.activityDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState icon="📝" title="No recent activities" message="Activities will appear here once the farmer logs updates." compact />
            )}
          </div>
        </div>

        {/* Applications */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            Credit Applications
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/applications/new?farmerId=${farmerId}`)}>+ New Application</button>
          </div>
          <div className="card-body" style={{ padding: recentApps.length ? 0 : undefined }}>
            {recentApps.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Crop</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {recentApps.map(app => (
                      <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                        <td>{getCropLabelSafe(app.cropType, lang)}</td>
                        <td>{app.currencyCode || 'KES'} {app.requestedAmount?.toLocaleString()}</td>
                        <td><StatusBadge value={app.status} /></td>
                        <td className="text-sm text-muted">{new Date(app.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="📄" title="No applications yet" message="Create a credit application to start the review process." compact />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
