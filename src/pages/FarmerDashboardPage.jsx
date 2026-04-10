import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useFarmStore } from '../store/farmStore.js';
import api from '../api/client.js';
import { tLifecycleStage, tStatus, getCurrentLang, setLang } from '../utils/i18n.js';
import OnboardingWizard from '../components/OnboardingWizard.jsx';
import FarrowayLogo from '../components/FarrowayLogo.jsx';
import { SkeletonFarmerDashboard } from '../components/SkeletonLoader.jsx';
import FarmerAvatar from '../components/FarmerAvatar.jsx';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import InlineAlert from '../components/InlineAlert.jsx';
import { getCropLabel, getCropIcon } from '../utils/crops.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { formatLandSize } from '../utils/landSize.js';
import VoiceBar from '../components/VoiceBar.jsx';

/** Collapsible section — keeps secondary content below the fold */
function ExpandableSection({ title, icon, children, testId }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={S.expandCard} data-testid={testId}>
      <button
        onClick={() => setOpen(o => !o)}
        style={S.expandHeader}
        aria-expanded={open}
      >
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}>{title}</span>
        <span style={{ color: '#A1A1AA', fontSize: '1.1rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
      </button>
      {open && <div style={S.expandBody}>{children}</div>}
    </div>
  );
}

export default function FarmerDashboardPage() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(null);
  const [seasons, setSeasons] = useState(null);

  // Farm profile + recommendations + weather + finance store
  const {
    profiles: farmProfiles, currentProfile: farmProfile, recommendations,
    weather, weatherRecs, financeScore, referral,
    fetchProfiles, fetchRecommendations, updateRecommendation,
    fetchWeather, fetchWeatherRecs, saveRecommendation,
    fetchFinanceScore, recalculateFinanceScore,
    submitRecFeedback, fetchReferral, trackEvent,
  } = useFarmStore();
  const { createProfile } = useFarmStore();
  const [recNoteId, setRecNoteId] = useState(null);
  const [recNote, setRecNote] = useState('');
  const [feedbackSent, setFeedbackSent] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    api.get('/auth/farmer-profile')
      .then(r => { setProfile(r.data); setProfileError(''); })
      .catch(() => setProfileError('Could not load your profile. Please check your connection.'))
      .finally(() => setLoading(false));
    // Load farm profiles + referral
    fetchProfiles().then(profiles => {
      if (profiles.length === 0) setShowOnboarding(true);
    }).catch(() => {
      // fetchProfiles failed — do NOT show onboarding, farmer may already be registered
      setProfileError('Could not load your farm data. Please check your connection and refresh.');
    });
    fetchReferral(); // supplemental — referral card just won't render if this fails
    trackEvent('dashboard_viewed'); // fire-and-forget analytics
  }, []);

  const [lang, setCurrentLang] = useState(getCurrentLang());

  const switchLang = async (newLang) => {
    await setLang(newLang);
    setCurrentLang(newLang);
    window.location.reload(); // reload to apply translations across all components
  };

  // Fetch recommendations + weather when farm profile is loaded
  useEffect(() => {
    if (farmProfile?.id) {
      fetchRecommendations(farmProfile.id);
      fetchWeather(farmProfile.id);
      fetchWeatherRecs(farmProfile.id);
      fetchFinanceScore(farmProfile.id);
    }
  }, [farmProfile?.id]);

  // Save a weather recommendation to history
  const handleSaveWeatherRec = async (rec) => {
    if (!farmProfile) return;
    await saveRecommendation(farmProfile.id, rec);
    trackEvent('recommendation_saved', { title: rec.title });
  };

  const handleRecAction = async (recId, status) => {
    if (!farmProfile) return;
    const data = { status };
    if (recNoteId === recId && recNote.trim()) data.farmerNote = recNote.trim();
    await updateRecommendation(farmProfile.id, recId, data);
    trackEvent(`recommendation_${status}`, { recId });
    setRecNoteId(null);
    setRecNote('');
  };

  const handleFeedback = async (recId, helpful) => {
    if (!farmProfile || feedbackSent[recId]) return;
    await submitRecFeedback(farmProfile.id, recId, helpful);
    setFeedbackSent(prev => ({ ...prev, [recId]: helpful ? 'yes' : 'no' }));
    trackEvent('recommendation_feedback', { recId, helpful });
  };

  const bandColor = (band) => {
    if (band === 'Strong') return '#22C55E';
    if (band === 'Good') return '#0EA5E9';
    if (band === 'Fair') return '#F59E0B';
    return '#EF4444';
  };

  const [photoUploadWarning, setPhotoUploadWarning] = useState('');

  const [onboardingError, setOnboardingError] = useState('');

  const handleOnboardingComplete = async (data) => {
    const { photoFile, ...allFields } = data;
    // CRITICAL: backend requires farmerName — inject from user record
    allFields.farmerName = user?.fullName || allFields.farmName || 'Farmer';
    setOnboardingError('');

    // Send everything (including gender, ageGroup, countryCode) in a single
    // atomic request — the backend handles farmer + farm profile in one transaction.
    let result;
    try {
      result = await createProfile(allFields);
    } catch (err) {
      trackPilotEvent('onboarding_failed', { error: err?.message || 'createProfile failed' });
      const msg = err?.response?.data?.error || 'Failed to create your farm profile. Please check your connection and try again.';
      setOnboardingError(msg);
      throw new Error(msg); // propagate to wizard so it shows error state
    }
    if (!result) {
      trackPilotEvent('onboarding_failed', { error: 'createProfile returned null' });
      const msg = 'Something went wrong creating your profile. Please try again.';
      setOnboardingError(msg);
      throw new Error(msg); // propagate to wizard so it shows error state
    }

    // Handle offline queued result
    if (result._offline) {
      setShowOnboarding(false);
      trackPilotEvent('onboarding_queued_offline', { crop: data.crop });
      return;
    }

    // Atomic response: { success, farmProfileComplete, nextRoute, profile }
    const newProfile = result.profile || result;
    const farmProfileComplete = result.farmProfileComplete ?? true;

    if (!farmProfileComplete) {
      trackPilotEvent('onboarding_incomplete', { crop: data.crop, reason: 'missing_required_fields' });
    }

    setShowOnboarding(false);
    trackEvent('onboarding_completed', { crop: data.crop, farmProfileComplete });
    trackPilotEvent('onboarding_completed', { crop: data.crop, farmProfileComplete });

    // Upload profile photo if provided (non-blocking — but inform user on failure)
    if (photoFile) {
      try {
        const formData = new FormData();
        formData.append('photo', photoFile);
        await api.post('/farmers/me/profile-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        trackPilotEvent('photo_uploaded', { context: 'onboarding' });
        api.get('/auth/farmer-profile').then(r => setProfile(r.data)).catch(() => {}); // refresh avatar — non-critical, photo already saved
      } catch {
        trackPilotEvent('photo_failed', { context: 'onboarding' });
        setPhotoUploadWarning('Your farm was created, but the profile photo could not be uploaded. You can add it later from your profile.');
      }
    }

    // Fetch new data for the created profile
    const profileId = newProfile.id;
    if (profileId) {
      fetchRecommendations(profileId);
      fetchWeather(profileId);
      fetchWeatherRecs(profileId);
      fetchFinanceScore(profileId);
    }
  };

  const isPending = user?.registrationStatus === 'pending_approval';
  const isRejected = user?.registrationStatus === 'rejected';
  const isApproved = user?.registrationStatus === 'approved';

  const [nextTask, setNextTask] = useState(null);

  const [dashError, setDashError] = useState('');

  useEffect(() => {
    if (isApproved && user?.farmerId) {
      setDashError('');
      api.get(`/lifecycle/farmers/${user.farmerId}`)
        .then(r => setLifecycle(r.data))
        .catch(() => {}); // lifecycle is supplemental — page still works without it
      api.get(`/seasons/farmer/${user.farmerId}?status=active`)
        .then(r => setSeasons(r.data))
        .catch(() => setSeasons([]));
      api.get('/tasks')
        .then(r => {
          const taskList = Array.isArray(r.data) ? r.data : [];
          setNextTask(taskList[0] || null);
        })
        .catch(() => {}); // tasks feed is supplemental
    }
  }, [isApproved, user?.farmerId]);

  return (
    <div style={styles.container}>
      {showOnboarding && isApproved && (
        <>
          {onboardingError && (
            <div style={{ padding: '0.5rem 1rem' }}>
              <InlineAlert variant="danger" onDismiss={() => setOnboardingError('')}>{onboardingError}</InlineAlert>
            </div>
          )}
          <OnboardingWizard userName={user?.fullName?.split(' ')[0]} countryCode={profile?.countryCode} onComplete={handleOnboardingComplete} />
        </>
      )}
      {photoUploadWarning && (
        <div style={{ padding: '0.5rem 1rem' }}>
          <InlineAlert variant="warning" onDismiss={() => setPhotoUploadWarning('')}>{photoUploadWarning}</InlineAlert>
        </div>
      )}
      <div style={styles.header}>
        <FarrowayLogo size={28} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => switchLang('en')}
              style={{ ...styles.langBtn, fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? '#22C55E' : '#A1A1AA' }}
            >EN</button>
            <button
              onClick={() => switchLang('sw')}
              style={{ ...styles.langBtn, fontWeight: lang === 'sw' ? 700 : 400, color: lang === 'sw' ? '#22C55E' : '#A1A1AA' }}
            >SW</button>
          </div>
          <button onClick={() => { logout(); window.location.href = '/login'; }} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.welcome}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FarmerAvatar
              fullName={user?.fullName}
              profileImageUrl={profile?.profileImageUrl}
              size={52}
              editable
              onClick={() => setShowPhotoUpload(true)}
            />
            <div>
              <h2 style={{ margin: 0 }}>Welcome, {user?.fullName}</h2>
              <p style={{ color: '#A1A1AA', margin: '0.25rem 0 0' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {showPhotoUpload && (
          <ProfilePhotoUpload
            farmerId={profile?.id}
            fullName={user?.fullName}
            currentImageUrl={profile?.profileImageUrl}
            onClose={() => setShowPhotoUpload(false)}
            onUploaded={() => {
              // Refresh avatar display — non-critical, photo already saved
              api.get('/auth/farmer-profile').then(r => setProfile(r.data)).catch(() => {});
            }}
            selfUpload
          />
        )}

        {profileError && (
          <InlineAlert variant="danger" onDismiss={() => setProfileError('')} action={{ label: 'Retry', onClick: () => { setLoading(true); setProfileError(''); api.get('/auth/farmer-profile').then(r => { setProfile(r.data); setProfileError(''); }).catch(() => setProfileError('Could not load your profile. Please check your connection.')).finally(() => setLoading(false)); } }}>{profileError}</InlineAlert>
        )}
        {loading ? (
          <SkeletonFarmerDashboard />
        ) : isPending ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('rgba(245,158,11,0.15)', '#F59E0B')}>Pending Approval</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration is Under Review</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              Thank you for registering with Farroway. Our team is reviewing your information.
              This usually takes 1-3 business days.
            </p>
            <div style={styles.infoBox}>
              <h4 style={{ margin: '0 0 0.5rem' }}>What to expect:</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#A1A1AA', lineHeight: 1.8 }}>
                <li>A field officer may contact you to verify your details</li>
                <li>You will receive a notification when your account is approved</li>
                <li>Once approved, you can submit credit applications and access all farmer services</li>
              </ul>
            </div>
            {profile && (
              <div style={styles.profileSummary}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#FFFFFF' }}>Your Registration Details</h4>
                <div style={styles.detailRow}><span>Name:</span> <span>{profile.fullName}</span></div>
                <div style={styles.detailRow}><span>Phone:</span> <span>{profile.phone}</span></div>
                <div style={styles.detailRow}><span>Region:</span> <span>{profile.region}{profile.district ? `, ${profile.district}` : ''}</span></div>
                {profile.primaryCrop && <div style={styles.detailRow}><span>Crop:</span> <span>{getCropLabel(profile.primaryCrop)}</span></div>}
                {(profile.landSizeValue || profile.farmSizeAcres) && <div style={styles.detailRow}><span>Farm Size:</span> <span>{formatLandSize(profile.landSizeValue || profile.farmSizeAcres, profile.landSizeUnit)}</span></div>}
              </div>
            )}
          </div>
        ) : isRejected ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('rgba(239,68,68,0.15)', '#EF4444')}>Registration Declined</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration Was Not Approved</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              Unfortunately, your registration could not be approved at this time.
              {profile?.rejectionReason && (
                <><br /><strong>Reason:</strong> {profile.rejectionReason}</>
              )}
            </p>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem' }}>
              If you believe this is an error, please contact your local Farroway office or field officer.
            </p>
          </div>
        ) : isApproved ? (
          <>
            {/* ─── ACTION-FIRST HOME SCREEN ─── */}

            {/* Voice guide for low-literacy farmers */}
            <VoiceBar voiceKey="home_welcome" />

            {/* 1. Crop Status Hero — crop icon, name, stage, weather at a glance */}
            {(() => {
              const activeSeason = seasons?.[0];
              const cropCode = activeSeason?.cropType || farmProfile?.crop;
              const cropName = cropCode ? getCropLabel(cropCode) : null;
              const cropIcon = cropCode ? getCropIcon(cropCode) : '🌱';
              const stage = lifecycle?.currentStage;
              const stageLabel = stage ? tLifecycleStage(stage) : null;
              const tempC = weather?.temperatureC != null ? Math.round(weather.temperatureC) : null;
              const rainMm = weather?.rainForecastMm;

              return (
                <div style={S.heroCard} data-testid="crop-status-hero">
                  <div style={S.heroTop}>
                    <span style={S.heroCropIcon}>{cropIcon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={S.heroCropName}>{cropName || 'My Farm'}</div>
                      {stageLabel && <span style={S.heroBadge}>{stageLabel}</span>}
                    </div>
                    {tempC !== null && (
                      <div style={S.heroWeather}>
                        <span style={S.heroTemp}>{tempC}°C</span>
                        {rainMm != null && <span style={S.heroRain}>{rainMm}mm rain</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 2. Primary Action Button — single big tap target */}
            {(() => {
              const hasActiveSeason = seasons && seasons.length > 0;
              const farmerId = user?.farmerId;
              const stage = lifecycle?.currentStage;
              const isHarvestStage = stage === 'harvest' || stage === 'post_harvest';
              const daysSinceUpdate = seasons?.[0]?.lastActivityDate
                ? Math.floor((Date.now() - new Date(seasons[0].lastActivityDate)) / 86400000)
                : null;
              const updateOverdue = daysSinceUpdate !== null && daysSinceUpdate >= 14;

              let btnLabel, btnIcon, btnHref, nextStepText;
              if (nextTask?.taskType === 'REPORT_HARVEST') {
                btnLabel = 'Report Harvest'; btnIcon = '🌾';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = nextTask.reason || 'Your crop is ready — submit your harvest report.';
              } else if (nextTask?.taskType === 'START_SEASON') {
                btnLabel = 'Start Season'; btnIcon = '🌱';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = nextTask.reason || 'Set up a new growing season to start tracking.';
              } else if (!hasActiveSeason) {
                btnLabel = 'Start Season'; btnIcon = '🌱';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = 'Start a new season to begin tracking your farm.';
              } else if (isHarvestStage) {
                btnLabel = 'Report Harvest'; btnIcon = '🌾';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = 'Your crop is at harvest stage — submit your report.';
              } else if (updateOverdue) {
                btnLabel = 'Add Update'; btnIcon = '📝';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = `No update in ${daysSinceUpdate} days — log an activity now.`;
              } else {
                const topRec = lifecycle?.recommendations?.[0];
                btnLabel = 'Add Update'; btnIcon = '📝';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = topRec?.title || 'Log your latest farm activity.';
              }

              return (
                <div style={S.actionSection} data-testid="primary-action-section">
                  {farmerId && (
                    <a href={btnHref} style={S.primaryActionBtn} data-testid="primary-action-btn">
                      <span style={S.primaryActionIcon}>{btnIcon}</span>
                      <span>{btnLabel}</span>
                    </a>
                  )}
                  {/* 3. Next Step — single instruction */}
                  <div style={S.nextStepText} data-testid="next-step-text">{nextStepText}</div>
                </div>
              );
            })()}

            {/* 4. Progress Indicator + Last Activity — compact row */}
            {(() => {
              const activeSeason = seasons?.[0];
              const activityCount = activeSeason?.activityCount || 0;
              const lastDate = activeSeason?.lastActivityDate;
              const daysSince = lastDate
                ? Math.floor((Date.now() - new Date(lastDate)) / 86400000)
                : null;

              // Simple progress: map lifecycle stages to % for visual
              const stageProgress = { land_preparation: 15, planting: 30, germination: 45, vegetative: 55, flowering: 65, fruiting: 75, harvest: 90, post_harvest: 100 };
              const progressPct = stageProgress[lifecycle?.currentStage] || 0;

              return activeSeason ? (
                <div style={S.progressCard} data-testid="progress-section">
                  {/* Progress ring */}
                  <div style={S.progressRow}>
                    <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0 }} data-testid="progress-ring">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#1E293B" strokeWidth="5" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#22C55E" strokeWidth="5"
                        strokeDasharray={`${(progressPct / 100) * 150.8} 150.8`}
                        strokeLinecap="round" transform="rotate(-90 28 28)" />
                      <text x="28" y="32" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">{progressPct}%</text>
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={S.progressLabel}>Season Progress</div>
                      <div style={S.progressSub}>{activityCount} update{activityCount !== 1 ? 's' : ''} logged</div>
                    </div>
                  </div>
                  {/* Last Activity */}
                  {lastDate && (
                    <div style={S.lastActivity} data-testid="last-activity">
                      <span style={S.lastActivityIcon}>📋</span>
                      <div style={{ flex: 1 }}>
                        <div style={S.lastActivityLabel}>Last update</div>
                        <div style={S.lastActivityDate}>
                          {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`}
                          {' · '}{new Date(lastDate).toLocaleDateString()}
                        </div>
                      </div>
                      {daysSince >= 14 && <span style={S.staleBadge}>⚠ Overdue</span>}
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* No season nudge */}
            {seasons && seasons.length === 0 && (
              <div style={S.noSeasonCard} data-testid="no-season-nudge">
                <span style={{ fontSize: '2rem' }}>🌱</span>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>No Active Season</div>
                <div style={{ fontSize: '0.85rem', color: '#A1A1AA', marginTop: '0.25rem' }}>
                  Start a season to track your progress
                </div>
              </div>
            )}

            {/* 5. Weather insight — compact inline if available */}
            {weatherRecs?.recommendations?.length > 0 && (
              <div style={S.weatherInsightCard} data-testid="weather-insight">
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🌤️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{weatherRecs.recommendations[0].title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{weatherRecs.recommendations[0].action}</div>
                </div>
              </div>
            )}

            {/* 6. Farm Score — compact summary */}
            {financeScore && (
              <div style={S.scoreCard} data-testid="farm-score-compact">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={S.scoreCircleSmall(financeScore.band)}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{financeScore.score}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Farm Score</div>
                    <div style={{ fontSize: '0.8rem', color: bandColor(financeScore.band) }}>{financeScore.band} · {financeScore.readiness}</div>
                  </div>
                </div>
                {financeScore.nextSteps?.[0] && (
                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #243041' }}>
                    {financeScore.nextSteps[0]}
                  </div>
                )}
              </div>
            )}

            {/* ─── EXPANDABLE SECONDARY SECTIONS ─── */}
            {/* Collapsible "More Details" area for secondary content */}
            <ExpandableSection title="My Farm Details" icon="🏡" testId="details-section">
              {farmProfile && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={styles.detailRow}><span>Farm:</span> <span>{farmProfile.farmName || farmProfile.farmerName}</span></div>
                  {farmProfile.locationName && <div style={styles.detailRow}><span>Location:</span> <span>{farmProfile.locationName}</span></div>}
                  {(farmProfile.landSizeValue || farmProfile.farmSizeAcres) && <div style={styles.detailRow}><span>Size:</span> <span>{formatLandSize(farmProfile.landSizeValue || farmProfile.farmSizeAcres, farmProfile.landSizeUnit)}</span></div>}
                  <div style={styles.detailRow}><span>Stage:</span> <span style={{ textTransform: 'capitalize' }}>{farmProfile.stage}</span></div>
                </div>
              )}
              {seasons && seasons.length > 0 && seasons.map(s => (
                <div key={s.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid #243041', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{getCropLabel(s.cropType)}</span>
                    <span style={{ color: '#22C55E' }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>
                    {formatLandSize(s.landSizeValue || s.farmSizeAcres, s.landSizeUnit)} · Planted {new Date(s.plantingDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </ExpandableSection>

            {recommendations.length > 0 && (
              <ExpandableSection title="Recommendations" icon="💡" testId="recommendations-section">
                {recommendations.slice(0, 3).map(rec => (
                  <div key={rec.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #243041' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{rec.action}</div>
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: rec.status === 'completed' ? 'rgba(34,197,94,0.15)' : rec.status === 'skipped' ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)',
                        color: rec.status === 'completed' ? '#22C55E' : rec.status === 'skipped' ? '#F59E0B' : '#0EA5E9',
                        textTransform: 'capitalize', whiteSpace: 'nowrap', marginLeft: '0.5rem',
                      }}>{rec.status}</span>
                    </div>
                    {rec.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={() => handleRecAction(rec.id, 'completed')} style={styles.recBtnDone}>Done</button>
                        <button onClick={() => handleRecAction(rec.id, 'skipped')} style={styles.recBtnSkip}>Skip</button>
                        <button onClick={() => setRecNoteId(recNoteId === rec.id ? null : rec.id)} style={styles.recBtnNote}>Note</button>
                      </div>
                    )}
                    {recNoteId === rec.id && (
                      <input value={recNote} onChange={e => setRecNote(e.target.value)} placeholder="Add a note..." style={styles.noteInput} />
                    )}
                    {rec.farmerNote && <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.3rem', fontStyle: 'italic' }}>Note: {rec.farmerNote}</div>}
                    {rec.status !== 'pending' && !feedbackSent[rec.id] && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#71717A' }}>Helpful?</span>
                        <button onClick={() => handleFeedback(rec.id, true)} style={styles.feedbackBtn}>Yes</button>
                        <button onClick={() => handleFeedback(rec.id, false)} style={styles.feedbackBtn}>No</button>
                      </div>
                    )}
                    {feedbackSent[rec.id] && <div style={{ fontSize: '0.7rem', color: '#71717A', marginTop: '0.3rem' }}>Thanks for your feedback</div>}
                  </div>
                ))}
              </ExpandableSection>
            )}

            {weather && weather.temperatureC != null && (
              <ExpandableSection title="Weather Details" icon="🌦️" testId="weather-section">
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{Math.round(weather.temperatureC)}°C</span>
                    <span style={styles.weatherLabel}>Temp</span>
                  </div>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{weather.rainForecastMm}mm</span>
                    <span style={styles.weatherLabel}>Rain (3d)</span>
                  </div>
                  {weather.humidityPct != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{weather.humidityPct}%</span>
                      <span style={styles.weatherLabel}>Humidity</span>
                    </div>
                  )}
                  {weather.windSpeedKmh != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{Math.round(weather.windSpeedKmh)}</span>
                      <span style={styles.weatherLabel}>Wind km/h</span>
                    </div>
                  )}
                </div>
                {weather.condition && <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>{weather.condition}</div>}
                {weatherRecs?.recommendations?.slice(0, 2).map((rec, i) => (
                  <div key={i} style={{ padding: '0.4rem 0', borderTop: '1px solid #243041', marginTop: '0.4rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{rec.action}</div>
                    <button onClick={() => handleSaveWeatherRec(rec)} style={{ ...styles.recBtnNote, marginTop: '0.3rem', fontSize: '0.7rem' }}>Save</button>
                  </div>
                ))}
              </ExpandableSection>
            )}

            {referral && (
              <ExpandableSection title="Invite a Farmer" icon="🤝" testId="referral-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    flex: 1, padding: '0.5rem 0.75rem', background: '#1E293B', borderRadius: '6px',
                    fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#FFFFFF', textAlign: 'center',
                  }}>{referral.code}</div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(referral.link || referral.code); trackEvent('referral_shared'); }}
                    style={{ padding: '0.6rem 1rem', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', minHeight: '44px' }}
                  >Copy</button>
                </div>
                {referral.referralCount > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#71717A' }}>{referral.referralCount} farmer{referral.referralCount !== 1 ? 's' : ''} joined</div>
                )}
              </ExpandableSection>
            )}

            {profile?.applications?.length > 0 && (
              <ExpandableSection title="My Applications" icon="📄" testId="applications-section">
                {profile.applications.map(app => (
                  <div key={app.id} style={{ ...styles.detailRow, padding: '0.5rem 0' }}>
                    <span style={{ fontWeight: 500 }}>{app.cropType}</span>
                    <span>{tStatus(app.status)}</span>
                  </div>
                ))}
              </ExpandableSection>
            )}

            {profile?.notifications?.length > 0 && (
              <ExpandableSection title="Notifications" icon="🔔" testId="notifications-section">
                {profile.notifications.map(n => (
                  <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #243041', fontSize: '0.875rem' }}>
                    <strong>{n.title}</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#A1A1AA' }}>{n.message}</p>
                  </div>
                ))}
              </ExpandableSection>
            )}

            {/* Help Button — fixed bottom-right */}
            <a
              href={user?.farmerId ? `/farmer-home/${user.farmerId}/notifications` : '#'}
              style={S.helpFab}
              data-testid="help-button"
              aria-label="Get help"
            >?</a>
          </>
        ) : (
          <div style={styles.card}>
            <p>Loading your account status...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Action-first home screen styles ────────────────────
const S = {
  heroCard: {
    background: '#162033', borderRadius: '12px', padding: '1rem 1.25rem',
    marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  heroTop: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  heroCropIcon: { fontSize: '2.2rem', lineHeight: 1 },
  heroCropName: { fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF' },
  heroBadge: {
    display: 'inline-block', marginTop: '0.25rem', padding: '0.2rem 0.7rem',
    borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
    background: 'rgba(34,197,94,0.15)', color: '#22C55E', textTransform: 'capitalize',
  },
  heroWeather: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0,
  },
  heroTemp: { fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' },
  heroRain: { fontSize: '0.7rem', color: '#0EA5E9', marginTop: '0.1rem' },

  // Primary action
  actionSection: { textAlign: 'center', marginBottom: '1.25rem' },
  primaryActionBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.6rem', width: '100%', padding: '1rem 1.5rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', color: '#FFFFFF',
    borderRadius: '14px', fontWeight: 800, fontSize: '1.15rem', textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
    minHeight: '56px', WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.1s', cursor: 'pointer',
  },
  primaryActionIcon: { fontSize: '1.4rem' },
  nextStepText: {
    marginTop: '0.6rem', fontSize: '0.9rem', color: '#A1A1AA', lineHeight: 1.5,
  },

  // Progress section
  progressCard: {
    background: '#162033', borderRadius: '12px', padding: '1rem 1.25rem',
    marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  progressRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  progressLabel: { fontWeight: 600, fontSize: '0.95rem', color: '#FFFFFF' },
  progressSub: { fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.1rem' },
  lastActivity: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #243041',
  },
  lastActivityIcon: { fontSize: '1.1rem', flexShrink: 0 },
  lastActivityLabel: { fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600 },
  lastActivityDate: { fontSize: '0.85rem', color: '#A1A1AA' },
  staleBadge: {
    fontSize: '0.7rem', fontWeight: 700, color: '#F59E0B', whiteSpace: 'nowrap',
    padding: '0.2rem 0.5rem', borderRadius: '8px', background: 'rgba(245,158,11,0.12)',
  },

  // No season
  noSeasonCard: {
    background: '#162033', borderRadius: '12px', padding: '1.5rem',
    textAlign: 'center', marginBottom: '1rem',
    border: '2px dashed #243041',
  },

  // Weather insight compact
  weatherInsightCard: {
    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
    background: '#162033', borderRadius: '10px', padding: '0.75rem 1rem',
    marginBottom: '0.75rem', borderLeft: '3px solid #0EA5E9',
  },

  // Score compact
  scoreCard: {
    background: '#162033', borderRadius: '10px', padding: '0.85rem 1rem',
    marginBottom: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  scoreCircleSmall: (band) => ({
    width: '44px', height: '44px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#1E293B', flexShrink: 0,
    border: `3px solid ${band === 'Strong' ? '#22C55E' : band === 'Good' ? '#0EA5E9' : band === 'Fair' ? '#F59E0B' : '#EF4444'}`,
  }),

  // Expandable sections
  expandCard: {
    background: '#162033', borderRadius: '10px', marginBottom: '0.5rem',
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  expandHeader: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
    padding: '0.85rem 1rem', background: 'transparent', border: 'none',
    color: '#FFFFFF', cursor: 'pointer', minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  expandBody: { padding: '0 1rem 1rem' },

  // Help FAB
  helpFab: {
    position: 'fixed', bottom: '1.25rem', right: '1.25rem',
    width: '52px', height: '52px', borderRadius: '50%',
    background: '#0EA5E9', color: '#FFFFFF', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem', fontWeight: 800, textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(14,165,233,0.4)',
    zIndex: 90, WebkitTapHighlightColor: 'transparent',
  },
};

const styles = {
  container: { minHeight: '100vh', background: '#0F172A' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem', background: '#162033', borderBottom: '1px solid #243041',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#22C55E', margin: 0 },
  logoutBtn: {
    padding: '0.5rem 0.75rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '6px', cursor: 'pointer', color: '#A1A1AA', fontSize: '0.8rem',
    minHeight: '44px',
  },
  langBtn: {
    padding: '0.5rem 0.7rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', minHeight: '44px',
  },
  content: { maxWidth: '600px', margin: '1rem auto', padding: '0 0.75rem' },
  welcome: { marginBottom: '1.5rem' },
  card: {
    background: '#162033', borderRadius: '8px', padding: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  statusBadge: (bg, color) => ({
    display: 'inline-block', padding: '0.35rem 0.85rem', borderRadius: '20px',
    fontSize: '0.8rem', fontWeight: 600, background: bg, color: color,
  }),
  infoBox: {
    background: '#1E293B', borderRadius: '6px', padding: '1rem', margin: '1rem 0 0',
  },
  profileSummary: {
    background: '#1E293B', borderRadius: '6px', padding: '1rem', marginTop: '1rem',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
    borderBottom: '1px solid #243041', fontSize: '0.9rem',
  },
  recBtnDone: {
    padding: '0.4rem 0.8rem', background: 'rgba(34,197,94,0.15)', color: '#22C55E',
    border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600, minHeight: '36px',
  },
  recBtnSkip: {
    padding: '0.4rem 0.8rem', background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600, minHeight: '36px',
  },
  recBtnNote: {
    padding: '0.4rem 0.8rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600, minHeight: '36px',
  },
  noteInput: {
    width: '100%', padding: '0.4rem 0.6rem', background: '#1E293B', border: '1px solid #243041',
    borderRadius: '6px', color: '#FFFFFF', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
  },
  scoreCircle: (band) => ({
    width: '64px', height: '64px', borderRadius: '50%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: '#1E293B',
    border: `3px solid ${band === 'Strong' ? '#22C55E' : band === 'Good' ? '#0EA5E9' : band === 'Fair' ? '#F59E0B' : '#EF4444'}`,
  }),
  weatherStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#1E293B', borderRadius: '8px', padding: '0.5rem 0.75rem', minWidth: '60px',
  },
  feedbackBtn: {
    padding: '0.2rem 0.5rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '4px', cursor: 'pointer',
    fontSize: '0.65rem', fontWeight: 600,
  },
  weatherValue: { fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' },
  weatherLabel: { fontSize: '0.65rem', color: '#71717A', marginTop: '0.1rem', textTransform: 'uppercase' },
};
