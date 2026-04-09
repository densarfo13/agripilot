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
import { getCropLabel } from '../utils/crops.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { formatLandSize } from '../utils/landSize.js';

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
    const { photoFile, ...profileData } = data;
    setOnboardingError('');
    let newProfile;
    try {
      newProfile = await createProfile(profileData);
    } catch (err) {
      trackPilotEvent('onboarding_failed', { error: err?.message || 'createProfile failed' });
      setOnboardingError('Failed to create your farm profile. Please check your connection and try again.');
      return; // stay on onboarding — don't dismiss
    }
    if (!newProfile) {
      trackPilotEvent('onboarding_failed', { error: 'createProfile returned null' });
      setOnboardingError('Something went wrong creating your profile. Please try again.');
      return;
    }
    setShowOnboarding(false);
    trackEvent('onboarding_completed', { crop: data.crop });
    trackPilotEvent('onboarding_completed', { crop: data.crop });

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
    fetchRecommendations(newProfile.id);
    fetchWeather(newProfile.id);
    fetchWeatherRecs(newProfile.id);
    fetchFinanceScore(newProfile.id);
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
            {/* Primary action card — single clear next step */}
            {(() => {
              const hasActiveSeason = seasons && seasons.length > 0;
              const farmerId = user?.farmerId;
              const stage = lifecycle?.currentStage;
              const isHarvestStage = stage === 'harvest' || stage === 'post_harvest';
              const daysSinceUpdate = seasons?.[0]?.lastActivityDate
                ? Math.floor((Date.now() - new Date(seasons[0].lastActivityDate)) / 86400000)
                : null;
              const updateOverdue = daysSinceUpdate !== null && daysSinceUpdate >= 14;

              // Pick the single most relevant action — prefer API-derived task
              let btnLabel, btnHref, cardTitle, cardDetail;
              if (nextTask?.taskType === 'REPORT_HARVEST') {
                btnLabel = 'Report Harvest →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Time to report your harvest';
                cardDetail = nextTask.reason;
              } else if (nextTask?.taskType === 'START_SEASON') {
                btnLabel = 'Start Season →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Set up your season';
                cardDetail = nextTask.reason;
              } else if (!hasActiveSeason) {
                btnLabel = 'Start Season →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Set up your season';
                cardDetail = 'Your account is active. Start a new season to begin tracking your farm progress.';
              } else if (isHarvestStage) {
                btnLabel = 'Report Harvest →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Time to report your harvest';
                cardDetail = 'Your crop is at harvest stage. Submit your harvest report to close the season.';
              } else if (updateOverdue) {
                btnLabel = 'Log Update →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = `No update in ${daysSinceUpdate} days`;
                cardDetail = 'Log a farm activity or update your crop condition to keep your record current.';
              } else {
                const topRec = lifecycle?.recommendations?.[0];
                btnLabel = 'Log Update →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = topRec?.title || 'Log your latest activity';
                cardDetail = topRec?.message || 'Regular updates help build a stronger track record.';
              }

              return (
                <div style={{ ...styles.card, marginBottom: '1rem', borderLeft: '4px solid #22C55E' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Your Next Step</div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.3rem' }}>{cardTitle}</div>
                  <div style={{ fontSize: '0.875rem', color: '#A1A1AA', lineHeight: 1.5, marginBottom: '1rem' }}>{cardDetail}</div>
                  {farmerId && (
                    <a href={btnHref} style={{
                      display: 'inline-block', padding: '0.6rem 1.4rem', background: '#22C55E', color: '#fff',
                      borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(22,163,74,0.18)',
                    }}>
                      {btnLabel}
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Farm Finance Score */}
            {financeScore && (
              <div style={{ ...styles.card, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Farroway Farm Score</h3>
                  <span style={{ fontSize: '0.65rem', color: '#71717A', textTransform: 'uppercase' }}>
                    {financeScore.confidence} confidence
                  </span>
                </div>

                {/* Score gauge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={styles.scoreCircle(financeScore.band)}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{financeScore.score}</span>
                    <span style={{ fontSize: '0.6rem', color: '#A1A1AA' }}>/100</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: bandColor(financeScore.band) }}>{financeScore.band}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{financeScore.readiness}</div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ background: '#1E293B', borderRadius: '4px', height: '6px', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: `${financeScore.score}%`, height: '100%', borderRadius: '4px',
                    background: bandColor(financeScore.band),
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Top factors */}
                {financeScore.factors?.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.8rem', borderBottom: '1px solid #243041' }}>
                    <span style={{ color: '#A1A1AA' }}>{f.label}</span>
                    <span style={{ fontWeight: 600, color: f.impact.startsWith('-') ? '#EF4444' : '#22C55E' }}>{f.impact}</span>
                  </div>
                ))}

                {/* Next steps */}
                {financeScore.nextSteps?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '0.3rem' }}>To improve</div>
                    {financeScore.nextSteps.map((step, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: '#A1A1AA', padding: '0.2rem 0', paddingLeft: '0.5rem', borderLeft: '2px solid #243041' }}>
                        {step}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => farmProfile && recalculateFinanceScore(farmProfile.id)}
                  style={{ ...styles.recBtnNote, marginTop: '0.75rem', fontSize: '0.7rem' }}
                >Recalculate</button>
              </div>
            )}

            {lifecycle && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={styles.statusBadge('rgba(34,197,94,0.15)', '#22C55E')}>Active Account</div>
                  <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>
                    {tLifecycleStage(lifecycle.currentStage)}{lifecycle.cropType ? ` · ${getCropLabel(lifecycle.cropType)}` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Card */}
            {weather && weather.temperatureC != null && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>Weather</h3>
                  <span style={{ fontSize: '0.7rem', color: '#71717A' }}>
                    {weather._source === 'live' ? 'Live' : weather._source === 'cached' ? 'Cached' : 'Estimated'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                {weather.condition && (
                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.5rem' }}>{weather.condition}</div>
                )}
              </div>
            )}

            {/* Weather-Based Recommendations */}
            {weatherRecs?.recommendations?.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem', borderLeft: '4px solid #0EA5E9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Weather Insights</div>
                {weatherRecs.recommendations.slice(0, 2).map((rec, i) => (
                  <div key={i} style={{ padding: '0.5rem 0', borderBottom: i < 1 ? '1px solid #243041' : 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>{rec.action}</div>
                    {rec.reason && <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.15rem' }}>{rec.reason}</div>}
                    <button
                      onClick={() => handleSaveWeatherRec(rec)}
                      style={{ ...styles.recBtnNote, marginTop: '0.4rem', fontSize: '0.7rem' }}
                    >Save to history</button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Seasons / Progress tracking */}
            {seasons && seasons.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>My Farm Progress</h3>
                {seasons.map(s => {
                  const daysSince = s.lastActivityDate
                    ? Math.floor((Date.now() - new Date(s.lastActivityDate)) / 86400000)
                    : null;
                  const isStale = daysSince !== null && daysSince >= 14;
                  return (
                    <div key={s.id} style={{
                      padding: '0.5rem 0', borderBottom: '1px solid #243041',
                      borderLeft: isStale ? '3px solid #F59E0B' : 'none',
                      paddingLeft: isStale ? '0.5rem' : 0,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 600 }}>{s.cropType}</span>
                        <span style={{ color: '#22C55E', fontWeight: 500 }}>{s.status}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>
                        {formatLandSize(s.landSizeValue || s.farmSizeAcres, s.landSizeUnit)} | Planted: {new Date(s.plantingDate).toLocaleDateString()}
                      </div>
                      {isStale && (
                        <div style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 600, marginTop: '0.25rem' }}>
                          {'\u26A0'} No update in {daysSince} days — log an activity to stay on track
                        </div>
                      )}
                    </div>
                  );
                })}
                <p style={{ fontSize: '0.8rem', color: '#71717A', margin: '0.5rem 0 0' }}>
                  Log activities, confirm stages, and track your harvest through your Farmer Home.
                </p>
              </div>
            )}

            {seasons && seasons.length === 0 && (
              <div style={{ ...styles.card, marginTop: '1rem', borderLeft: '4px solid #F59E0B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{'\uD83C\uDF31'}</span>
                  <h3 style={{ margin: 0 }}>No Active Season</h3>
                </div>
                <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  You don't have an active growing season yet. Start one to begin tracking your farm progress, get personalized recommendations, and build your credit history.
                </p>
                {user?.farmerId && (
                  <a href={`/farmer-home/${user.farmerId}/progress`} style={{
                    display: 'inline-block', padding: '0.5rem 1.2rem', background: '#F59E0B', color: '#fff',
                    borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
                  }}>
                    Start a Season {'\u2192'}
                  </a>
                )}
              </div>
            )}

            {/* Farm Profile Summary */}
            {farmProfile && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>My Farm</h3>
                  <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, textTransform: 'uppercase' }}>{farmProfile.crop}</span>
                </div>
                <div style={styles.detailRow}><span>Farm:</span> <span>{farmProfile.farmName || farmProfile.farmerName}</span></div>
                {farmProfile.locationName && <div style={styles.detailRow}><span>Location:</span> <span>{farmProfile.locationName}</span></div>}
                {(farmProfile.landSizeValue || farmProfile.farmSizeAcres) && <div style={styles.detailRow}><span>Size:</span> <span>{formatLandSize(farmProfile.landSizeValue || farmProfile.farmSizeAcres, farmProfile.landSizeUnit)}</span></div>}
                <div style={styles.detailRow}><span>Stage:</span> <span style={{ textTransform: 'capitalize' }}>{farmProfile.stage}</span></div>
              </div>
            )}

            {/* Recommendation History */}
            {recommendations.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>Recent Recommendations</h3>
                {recommendations.slice(0, 3).map(rec => (
                  <div key={rec.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #243041' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>{rec.action}</div>
                        {rec.reason && <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.15rem' }}>{rec.reason}</div>}
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: rec.status === 'completed' ? 'rgba(34,197,94,0.15)' : rec.status === 'skipped' ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)',
                        color: rec.status === 'completed' ? '#22C55E' : rec.status === 'skipped' ? '#F59E0B' : '#0EA5E9',
                        textTransform: 'capitalize', whiteSpace: 'nowrap', marginLeft: '0.5rem',
                      }}>{rec.status}</span>
                    </div>
                    {rec.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => handleRecAction(rec.id, 'completed')} style={styles.recBtnDone}>Done</button>
                        <button onClick={() => handleRecAction(rec.id, 'skipped')} style={styles.recBtnSkip}>Skip</button>
                        <button onClick={() => setRecNoteId(recNoteId === rec.id ? null : rec.id)} style={styles.recBtnNote}>Note</button>
                      </div>
                    )}
                    {recNoteId === rec.id && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <input
                          value={recNote} onChange={e => setRecNote(e.target.value)}
                          placeholder="Add a note..."
                          style={{ ...styles.noteInput }}
                        />
                      </div>
                    )}
                    {rec.farmerNote && <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.3rem', fontStyle: 'italic' }}>Note: {rec.farmerNote}</div>}
                    {rec.status !== 'pending' && !feedbackSent[rec.id] && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#71717A' }}>Was this helpful?</span>
                        <button onClick={() => handleFeedback(rec.id, true)} style={styles.feedbackBtn}>Yes</button>
                        <button onClick={() => handleFeedback(rec.id, false)} style={styles.feedbackBtn}>No</button>
                      </div>
                    )}
                    {feedbackSent[rec.id] && (
                      <div style={{ fontSize: '0.7rem', color: '#71717A', marginTop: '0.3rem' }}>Thanks for your feedback</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Referral Card */}
            {referral && (
              <div style={{ ...styles.card, marginTop: '1rem', borderLeft: '4px solid #8B5CF6' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Invite a Farmer</div>
                <p style={{ fontSize: '0.85rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
                  Share your code with other farmers to help them join Farroway.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    flex: 1, padding: '0.5rem 0.75rem', background: '#1E293B', borderRadius: '6px',
                    fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#FFFFFF', textAlign: 'center',
                  }}>{referral.code}</div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(referral.link || referral.code);
                      trackEvent('referral_shared');
                    }}
                    style={{
                      padding: '0.5rem 1rem', background: '#8B5CF6', color: '#fff', border: 'none',
                      borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    }}
                  >Copy</button>
                </div>
                {referral.referralCount > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#71717A' }}>{referral.referralCount} farmer{referral.referralCount !== 1 ? 's' : ''} joined with your code</div>
                )}
              </div>
            )}

            {profile && profile.applications && profile.applications.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>My Applications</h3>
                {profile.applications.map(app => (
                  <div key={app.id} style={{ ...styles.detailRow, padding: '0.5rem 0' }}>
                    <span style={{ fontWeight: 500 }}>{app.cropType}</span>
                    <span>{tStatus(app.status)}</span>
                  </div>
                ))}
              </div>
            )}

            {profile && profile.notifications && profile.notifications.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>Notifications</h3>
                {profile.notifications.map(n => (
                  <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #243041', fontSize: '0.875rem' }}>
                    <strong>{n.title}</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#A1A1AA' }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}
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

const styles = {
  container: { minHeight: '100vh', background: '#0F172A' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem', background: '#162033', borderBottom: '1px solid #243041',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#22C55E', margin: 0 },
  logoutBtn: {
    padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '6px', cursor: 'pointer', color: '#A1A1AA', fontSize: '0.8rem',
    minHeight: '36px',
  },
  langBtn: {
    padding: '0.4rem 0.7rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', minHeight: '36px',
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
