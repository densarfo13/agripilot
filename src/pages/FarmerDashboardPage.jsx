import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useFarmStore } from '../store/farmStore.js';
import api from '../api/client.js';
import { calculateFarmScore, getMissingProfileItems } from '../utils/farmScore.js';
import { tLifecycleStage, tStatus } from '../utils/i18n.js';
import { useTranslation, LANGUAGES } from '../i18n/index.js';
import OnboardingWizard from '../components/OnboardingWizard.jsx';
import FarrowayLogo from '../components/FarrowayLogo.jsx';
import { SkeletonFarmerDashboard } from '../components/SkeletonLoader.jsx';
import FarmerAvatar from '../components/FarmerAvatar.jsx';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import InlineAlert from '../components/InlineAlert.jsx';
import { getCropLabel, getCropIcon } from '../utils/crops.js';
import CropImage from '../components/CropImage.jsx';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { formatLandSize } from '../utils/landSize.js';
import VoiceBar from '../components/VoiceBar.jsx';
import FarmerUuidBadge from '../components/FarmerUuidBadge.jsx';
import { getFarmerLifecycleState, FARMER_STATE, canShowScore, canStartSeason } from '../utils/farmerLifecycle.js';
import {
  resolveProfileCompletionRoute, routeToUrl,
} from '../core/multiFarm/index.js';
import { buildFarmerTaskViewModel } from '../domain/tasks/index.js';
import { calculateMomentum } from '../engine/momentumCalculator.js';

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
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(null);
  const [seasons, setSeasons] = useState(null);

  // Farm profile + recommendations + weather + finance store
  const {
    profiles: farmProfiles, currentProfile: farmProfile, recommendations,
    weather, weatherRecs, financeScore, referral, _fromCache,
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
    // ─── Account load: bulletproof against the infinite-loading bug ──
    // Previous version left `loading=true` semantics up to the render
    // branch, which only checked `profile` — any caught failure with
    // no cached fallback + no offline user set `profileError` but
    // left `profile` null, so the UI fell through to the "Loading
    // your account status..." card forever.
    //
    // Fixes in order:
    //   • AbortController with an 8 s timeout so a stalled request
    //     can't pin the spinner (spec §4)
    //   • try/catch around every async branch, setLoading(false)
    //     in the finally block EVERY time (spec §1 + §2)
    //   • explicit 401 / 403 handling — clear auth + redirect to
    //     /login with a session-expired reason (spec §5)
    //   • console.error("ACCOUNT LOAD ERROR:", err) on any failure
    //     (spec §6)
    //   • render branch below now honours profileError + loading
    //     separately, so a failure shows a real error UI instead of
    //     the "Loading…" fallback
    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    (async () => {
      try {
        const r = await api.get('/auth/farmer-profile', { signal: controller.signal });
        if (!alive) return;
        setProfile(r.data);
        setProfileError('');
        try { localStorage.setItem('farroway:farmerProfile', JSON.stringify(r.data)); } catch {}
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ACCOUNT LOAD ERROR:', err);
        if (!alive) return;

        const status = err && err.response && err.response.status;
        const aborted = err && (err.name === 'AbortError' || err.name === 'CanceledError'
          || err.code === 'ERR_CANCELED' || err.code === 'ECONNABORTED');

        // 401 / 403 — clear the session and bounce to /login with
        // a reason so the user sees the info banner there.
        if (status === 401 || status === 403) {
          try { useAuthStore.getState().logout?.(); } catch { /* noop */ }
          try { localStorage.removeItem('farroway:farmerProfile'); } catch { /* noop */ }
          navigate('/login', {
            replace: true,
            state: { reason: 'session_expired',
                     from: window.location.pathname + window.location.search },
          });
          return;
        }

        // Fall back to the cached profile first, then the authStore
        // user (for offline sessions) — BUT only claim success if we
        // actually have something to render. Otherwise set a loud
        // error the UI can show.
        const cachedProfile = (() => {
          try { return JSON.parse(localStorage.getItem('farroway:farmerProfile')); }
          catch { return null; }
        })();
        if (cachedProfile) {
          setProfile(cachedProfile);
          setProfileError('');
        } else if (!navigator.onLine && user) {
          setProfile(user);
          setProfileError('');
        } else {
          setProfileError(aborted
            ? 'Unable to load account. The request timed out. Please refresh or login again.'
            : 'Unable to load account. Please refresh or login again.');
        }
      } finally {
        clearTimeout(timeoutId);
        if (alive) setLoading(false);
      }
    })();

    // Load farm profiles + referral (farmStore now hydrates from cache if offline)
    (async () => {
      try {
        const profiles = await fetchProfiles();
        if (alive && profiles.length === 0 && !_fromCache) setShowOnboarding(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ACCOUNT LOAD ERROR:', err);
        if (alive && !_fromCache) {
          setProfileError((prev) => prev
            || 'Could not load your farm data. Please check your connection and refresh.');
        }
      }
    })();

    fetchReferral(); // supplemental — referral card just won't render if this fails
    trackEvent('dashboard_viewed'); // fire-and-forget analytics

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);   // once on mount — never loop

  const { t, lang, setLang: switchLang } = useTranslation();

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

    // Respect server-provided nextRoute — if it points somewhere other than
    // the current farmer home, navigate explicitly to avoid stale state.
    const nextRoute = result.nextRoute;
    if (nextRoute && nextRoute !== '/home' && nextRoute !== '/') {
      window.location.href = nextRoute;
      return;
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

  // ── Farmer lifecycle state — single source of truth ──
  const farmerLifecycle = getFarmerLifecycleState({
    farmProfile: farmProfile || null,
    countryCode: profile?.countryCode || farmProfile?.countryCode,
  });
  const isActive = farmerLifecycle.state === FARMER_STATE.ACTIVE;
  const isSetupIncomplete = farmerLifecycle.state === FARMER_STATE.SETUP_INCOMPLETE;
  const isNew = farmerLifecycle.state === FARMER_STATE.NEW;
  const setupComplete = farmerLifecycle.complete;

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

  // Task view model for context-aware display (WHY/TIMING/RISK — spec §8)
  const taskViewModel = useMemo(() => {
    if (!nextTask || !setupComplete) return null;
    const cropStage = farmProfile?.cropStage || farmProfile?.stage || '';
    return buildFarmerTaskViewModel({
      task: nextTask,
      action: null,
      weatherGuidance: null,
      language: lang,
      t,
      mode: 'simple',
      cropStage,
      weather,
    });
  }, [nextTask, setupComplete, farmProfile, lang, t, weather]);

  // Momentum signal (spec §7)
  const momentum = useMemo(() => {
    if (!setupComplete) return null;
    const cropStage = farmProfile?.cropStage || farmProfile?.stage || '';
    return calculateMomentum({
      completedToday: 0,
      remainingToday: nextTask ? 1 : 0,
      totalTasks: 1,
      cropStage,
      completionPercent: 0,
    });
  }, [setupComplete, farmProfile, nextTask]);

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
      {_fromCache && (
        <div data-testid="offline-cache-banner" style={{ padding: '0.4rem 1rem', background: '#1E293B', textAlign: 'center', fontSize: '0.8rem', color: '#F59E0B', borderBottom: '1px solid #243041' }}>
          📡 {t('home.showingCached')}
        </div>
      )}
      <div style={styles.header}>
        <FarrowayLogo size={28} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                style={{ ...styles.langBtn, fontWeight: lang === l.code ? 700 : 400, color: lang === l.code ? '#22C55E' : '#A1A1AA' }}
              >{l.short}</button>
            ))}
          </div>
          <button onClick={() => { logout(); window.location.href = '/login'; }} style={styles.logoutBtn}>
            {t('common.signOut')}
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
              <h2 style={{ margin: 0 }}>{t('home.welcome')} {user?.fullName}</h2>
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
          <InlineAlert variant="danger" onDismiss={() => setProfileError('')} action={{ label: t('common.retry'), onClick: () => { setLoading(true); setProfileError(''); api.get('/auth/farmer-profile').then(r => { setProfile(r.data); setProfileError(''); }).catch(() => setProfileError(t('error.loadProfile'))).finally(() => setLoading(false)); } }}>{profileError}</InlineAlert>
        )}
        {loading ? (
          <SkeletonFarmerDashboard />
        ) : isPending ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('rgba(245,158,11,0.15)', '#F59E0B')}>{t('home.pendingApproval')}</div>
            <h3 style={{ marginTop: '1rem' }}>{t('home.registrationReview')}</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              {t('home.pending.thankYou')} {t('home.pending.timeline')}
            </p>
            <div style={styles.infoBox}>
              <h4 style={{ margin: '0 0 0.5rem' }}>{t('home.whatToExpect')}</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#A1A1AA', lineHeight: 1.8 }}>
                <li>{t('home.pending.expect.verify')}</li>
                <li>{t('home.pending.expect.notify')}</li>
                <li>{t('home.pending.expect.unlock')}</li>
              </ul>
            </div>
            {profile && (
              <div style={styles.profileSummary}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#FFFFFF' }}>{t('home.registrationDetails')}</h4>
                <div style={styles.detailRow}><span>{t('home.name')}</span> <span>{profile.fullName}</span></div>
                <div style={styles.detailRow}><span>{t('home.phone')}</span> <span>{profile.phone}</span></div>
                <div style={styles.detailRow}><span>{t('home.region')}</span> <span>{profile.region}{profile.district ? `, ${profile.district}` : ''}</span></div>
                {profile.primaryCrop && <div style={styles.detailRow}><span>{t('home.crop')}</span> <span>{getCropLabel(profile.primaryCrop)}</span></div>}
                {(profile.landSizeValue || profile.farmSizeAcres) && <div style={styles.detailRow}><span>{t('home.farmSize')}</span> <span>{formatLandSize(profile.landSizeValue || profile.farmSizeAcres, profile.landSizeUnit)}</span></div>}
              </div>
            )}
          </div>
        ) : isRejected ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('rgba(239,68,68,0.15)', '#EF4444')}>{t('home.registrationDeclined')}</div>
            <h3 style={{ marginTop: '1rem' }}>{t('home.registrationDeclined')}</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              {t('home.rejected.explanation')}
              {profile?.rejectionReason && (
                <><br /><strong>{t('home.rejected.reasonLabel')}</strong> {profile.rejectionReason}</>
              )}
            </p>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem' }}>
              {t('home.rejected.contactHint')}
            </p>
          </div>
        ) : isApproved ? (
          <>
            {/* ─── ACTION-FIRST HOME SCREEN ─── */}

            {/* Voice guide for low-literacy farmers */}
            <VoiceBar voiceKey="home.welcome" />

            {/* Farmer UUID badge — persistent identifier */}
            {farmProfile?.farmerUuid && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <FarmerUuidBadge />
              </div>
            )}

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
                    {cropCode ? (
                      <CropImage
                        cropKey={cropCode}
                        alt={cropName || 'Crop'}
                        size={48}
                        circular
                      />
                    ) : (
                      <span style={S.heroCropIcon}>{cropIcon}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={S.heroCropName}>{cropName || t('home.myFarm')}</div>
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

            {/* 2. Primary Action Button — state-locked by lifecycle */}
            {(() => {
              const farmerId = user?.farmerId;

              // ── Setup-required states: CTA = "Complete Profile" → /profile/setup ──
              if (!setupComplete) {
                const profileScore = calculateFarmScore(farmProfile, { countryCode: profile?.countryCode || farmProfile?.countryCode });
                const missingItems = getMissingProfileItems(farmProfile, { countryCode: profile?.countryCode || farmProfile?.countryCode });
                return (
                  <div style={S.actionSection} data-testid="primary-action-section">
                    {/* Progress bar */}
                    {profileScore.score > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ height: '6px', borderRadius: '3px', background: '#1E293B', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #22C55E, #16A34A)', width: `${profileScore.score}%`, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{profileScore.score}% complete</span>
                          <span style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>{profileScore.status}</span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        const dest = resolveProfileCompletionRoute({
                          profile: farmProfile, farms: [],
                          reason: isNew ? 'setup' : 'complete_profile',
                        });
                        navigate(routeToUrl(dest));
                      }}
                      style={S.primaryActionBtn}
                      data-testid="primary-action-btn"
                    >
                      <span style={S.primaryActionIcon}>{isNew ? '📋' : '✏️'}</span>
                      <span>{isNew ? t('home.setUpFarm') : t('home.finishSetup')}</span>
                    </button>
                    <div style={S.nextStepText} data-testid="next-step-text">
                      {isNew
                        ? t('home.createProfileToStart')
                        : missingItems.length > 0
                          ? `${t('home.completeProfile')} ${t('home.missing')} ${missingItems.join(', ')}.`
                          : t('home.completeProfile')
                      }
                    </div>
                  </div>
                );
              }

              // ── ACTIVE state: normal CTA logic ──
              const hasActiveSeason = seasons && seasons.length > 0;
              const stage = lifecycle?.currentStage;
              const isHarvestStage = stage === 'harvest' || stage === 'post_harvest';
              const daysSinceUpdate = seasons?.[0]?.lastActivityDate
                ? Math.floor((Date.now() - new Date(seasons[0].lastActivityDate)) / 86400000)
                : null;
              const updateOverdue = daysSinceUpdate !== null && daysSinceUpdate >= 14;

              let btnLabel, btnIcon, btnHref, nextStepText;
              if (nextTask?.taskType === 'REPORT_HARVEST') {
                btnLabel = t('home.reportHarvest'); btnIcon = '🌾';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = nextTask.reason || t('home.cropReadyHarvest');
              } else if (nextTask?.taskType === 'START_SEASON') {
                btnLabel = t('home.startSeason'); btnIcon = '🌱';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = nextTask.reason || t('home.setUpSeason');
              } else if (!hasActiveSeason) {
                btnLabel = t('home.startSeason'); btnIcon = '🌱';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = t('home.startNewSeason');
              } else if (isHarvestStage) {
                btnLabel = t('home.reportHarvest'); btnIcon = '🌾';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = t('home.atHarvestStage');
              } else if (updateOverdue) {
                btnLabel = t('home.addUpdate'); btnIcon = '📝';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = t('home.noUpdateDays', { days: daysSinceUpdate });
              } else {
                const topRec = lifecycle?.recommendations?.[0];
                btnLabel = t('home.addUpdate'); btnIcon = '📝';
                btnHref = `/farmer-home/${farmerId}/progress`;
                nextStepText = topRec?.title || t('home.logActivity');
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
                  {/* Context lines — WHY / TIMING / RISK (spec §8) */}
                  {taskViewModel?.whyText && (
                    <div style={S.contextLine} data-testid="why-line">
                      <span style={S.contextDot(taskViewModel.urgencyStyle?.accent || '#22C55E')} />
                      <span>{taskViewModel.whyText}</span>
                    </div>
                  )}
                  {taskViewModel?.timingText && (
                    <div style={S.contextLine} data-testid="timing-line">
                      <span style={S.contextDot('#0EA5E9')} />
                      <span>{taskViewModel.timingText}</span>
                    </div>
                  )}
                  {taskViewModel?.riskText && (
                    <div style={{ ...S.contextLine, color: '#F59E0B' }} data-testid="risk-line">
                      <span style={S.contextDot('#F59E0B')} />
                      <span>{taskViewModel.riskText}</span>
                    </div>
                  )}
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
                      <div style={S.progressLabel}>{t('home.seasonProgress')}</div>
                      <div style={S.progressSub}>{activityCount} {activityCount !== 1 ? t('home.updatesLogged') : t('home.updateLogged')}</div>
                      {momentum?.momentumTextKey && (
                        <div style={S.momentumText} data-testid="momentum-signal">{t(momentum.momentumTextKey)}</div>
                      )}
                    </div>
                  </div>
                  {/* Last Activity */}
                  {lastDate && (
                    <div style={S.lastActivity} data-testid="last-activity">
                      <span style={S.lastActivityIcon}>📋</span>
                      <div style={{ flex: 1 }}>
                        <div style={S.lastActivityLabel}>{t('home.lastUpdate')}</div>
                        <div style={S.lastActivityDate}>
                          {daysSince === 0 ? t('home.today') : daysSince === 1 ? t('home.yesterday') : `${daysSince} ${t('home.daysAgo')}`}
                          {' · '}{new Date(lastDate).toLocaleDateString()}
                        </div>
                      </div>
                      {daysSince >= 14 && <span style={S.staleBadge}>⚠ {t('home.overdue')}</span>}
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* No season nudge — only for ACTIVE farmers */}
            {setupComplete && seasons && seasons.length === 0 && (
              <div style={S.noSeasonCard} data-testid="no-season-nudge">
                <span style={{ fontSize: '2rem' }}>🌱</span>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>{t('home.noActiveSeason')}</div>
                <div style={{ fontSize: '0.85rem', color: '#A1A1AA', marginTop: '0.25rem' }}>
                  {t('home.startSeasonToTrack')}
                </div>
              </div>
            )}

            {/* Setup-incomplete banner — show what's missing */}
            {!setupComplete && farmProfile && (
              <div style={{ ...S.noSeasonCard, borderColor: '#F59E0B' }} data-testid="setup-incomplete-banner">
                <span style={{ fontSize: '2rem' }}>📋</span>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>{t('home.setupRequired')}</div>
                <div style={{ fontSize: '0.85rem', color: '#A1A1AA', marginTop: '0.25rem' }}>
                  {t('home.completeProfile')}
                </div>
                {farmerLifecycle.missing.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#F59E0B', marginTop: '0.5rem' }}>
                    {t('home.missing')} {farmerLifecycle.missing.join(', ')}
                  </div>
                )}
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

            {/* 6. Farm Score — only for ACTIVE farmers with real scores */}
            {financeScore && setupComplete && !financeScore.setupRequired && (
              <div style={S.scoreCard} data-testid="farm-score-compact">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={S.scoreCircleSmall(financeScore.band)}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{financeScore.score}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('home.farmScore')}</div>
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
            <ExpandableSection title={t('home.farmDetails')} icon="🏡" testId="details-section">
              {farmProfile && (
                <div style={{ marginBottom: '0.75rem' }}>
                  {farmProfile.farmerUuid && <div style={styles.detailRow}><span>{t('home.farmerId')}</span> <span style={{ fontFamily: 'monospace', color: '#22C55E' }}>{farmProfile.farmerUuid}</span></div>}
                  <div style={styles.detailRow}><span>{t('home.farm')}</span> <span>{farmProfile.farmName || farmProfile.farmerName}</span></div>
                  {farmProfile.locationName && <div style={styles.detailRow}><span>{t('home.location')}</span> <span>{farmProfile.locationName}</span></div>}
                  {(farmProfile.landSizeValue || farmProfile.farmSizeAcres) && <div style={styles.detailRow}><span>{t('home.size')}</span> <span>{formatLandSize(farmProfile.landSizeValue || farmProfile.farmSizeAcres, farmProfile.landSizeUnit)}</span></div>}
                  <div style={styles.detailRow}><span>{t('home.stage')}</span> <span style={{ textTransform: 'capitalize' }}>{farmProfile.stage}</span></div>
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
              <ExpandableSection title={t('home.recommendations')} icon="💡" testId="recommendations-section">
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
                        <button onClick={() => handleRecAction(rec.id, 'completed')} style={styles.recBtnDone}>{t('common.done')}</button>
                        <button onClick={() => handleRecAction(rec.id, 'skipped')} style={styles.recBtnSkip}>{t('common.skip')}</button>
                        <button onClick={() => setRecNoteId(recNoteId === rec.id ? null : rec.id)} style={styles.recBtnNote}>{t('home.note')}</button>
                      </div>
                    )}
                    {recNoteId === rec.id && (
                      <input value={recNote} onChange={e => setRecNote(e.target.value)} placeholder={t('home.addNote')} style={styles.noteInput} />
                    )}
                    {rec.farmerNote && <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.3rem', fontStyle: 'italic' }}>Note: {rec.farmerNote}</div>}
                    {rec.status !== 'pending' && !feedbackSent[rec.id] && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#71717A' }}>{t('home.helpful')}</span>
                        <button onClick={() => handleFeedback(rec.id, true)} style={styles.feedbackBtn}>{t('common.yes')}</button>
                        <button onClick={() => handleFeedback(rec.id, false)} style={styles.feedbackBtn}>{t('common.no')}</button>
                      </div>
                    )}
                    {feedbackSent[rec.id] && <div style={{ fontSize: '0.7rem', color: '#71717A', marginTop: '0.3rem' }}>{t('home.thanksForFeedback')}</div>}
                  </div>
                ))}
              </ExpandableSection>
            )}

            {weather && weather.temperatureC != null && (
              <ExpandableSection title={t('home.weatherDetails')} icon="🌦️" testId="weather-section">
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{Math.round(weather.temperatureC)}°C</span>
                    <span style={styles.weatherLabel}>{t('home.temp')}</span>
                  </div>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{weather.rainForecastMm}mm</span>
                    <span style={styles.weatherLabel}>{t('home.rain3d')}</span>
                  </div>
                  {weather.humidityPct != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{weather.humidityPct}%</span>
                      <span style={styles.weatherLabel}>{t('home.humidity')}</span>
                    </div>
                  )}
                  {weather.windSpeedKmh != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{Math.round(weather.windSpeedKmh)}</span>
                      <span style={styles.weatherLabel}>{t('home.windKmh')}</span>
                    </div>
                  )}
                </div>
                {weather.condition && <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>{weather.condition}</div>}
                {weatherRecs?.recommendations?.slice(0, 2).map((rec, i) => (
                  <div key={i} style={{ padding: '0.4rem 0', borderTop: '1px solid #243041', marginTop: '0.4rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{rec.action}</div>
                    <button onClick={() => handleSaveWeatherRec(rec)} style={{ ...styles.recBtnNote, marginTop: '0.3rem', fontSize: '0.7rem' }}>{t('common.save')}</button>
                  </div>
                ))}
              </ExpandableSection>
            )}

            {referral && (
              <ExpandableSection title={t('home.inviteFarmer')} icon="🤝" testId="referral-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    flex: 1, padding: '0.5rem 0.75rem', background: '#1E293B', borderRadius: '6px',
                    fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#FFFFFF', textAlign: 'center',
                  }}>{referral.code}</div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(referral.link || referral.code); trackEvent('referral_shared'); }}
                    style={{ padding: '0.6rem 1rem', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', minHeight: '44px' }}
                  >{t('common.copy')}</button>
                </div>
                {referral.referralCount > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#71717A' }}>{referral.referralCount} farmer{referral.referralCount !== 1 ? 's' : ''} joined</div>
                )}
              </ExpandableSection>
            )}

            {profile?.applications?.length > 0 && (
              <ExpandableSection title={t('home.myApplications')} icon="📄" testId="applications-section">
                {profile.applications.map(app => (
                  <div key={app.id} style={{ ...styles.detailRow, padding: '0.5rem 0' }}>
                    <span style={{ fontWeight: 500 }}>{app.cropType}</span>
                    <span>{tStatus(app.status)}</span>
                  </div>
                ))}
              </ExpandableSection>
            )}

            {profile?.notifications?.length > 0 && (
              <ExpandableSection title={t('home.notifications')} icon="🔔" testId="notifications-section">
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
        ) : loading ? (
          <div style={styles.card}>
            <p>{t('home.loadingAccount')}</p>
          </div>
        ) : profileError ? (
          <div style={styles.card} data-testid="farmer-account-error" role="alert">
            <p style={{ margin: 0, marginBottom: '0.75rem' }}>{profileError}</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 12, border: 'none',
                  background: '#22C55E', color: '#fff', fontWeight: 700,
                  cursor: 'pointer', touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                data-testid="farmer-account-refresh"
              >
                {t('common.refresh') || 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try { useAuthStore.getState().logout?.(); } catch { /* noop */ }
                  navigate('/login', { replace: true,
                    state: { reason: 'session_expired' } });
                }}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'transparent', color: '#EAF2FF', fontWeight: 600,
                  cursor: 'pointer', touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                data-testid="farmer-account-login"
              >
                {t('auth.backToLogin') || 'Login again'}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.card} data-testid="farmer-account-empty">
            <p>{t('home.loadingAccount')}</p>
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

  // Context lines (spec §8)
  contextLine: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    marginTop: '0.35rem', fontSize: '0.8rem', color: '#9FB3C8', lineHeight: 1.4,
    textAlign: 'left',
  },
  contextDot: (color) => ({
    width: '6px', height: '6px', borderRadius: '50%',
    background: color, flexShrink: 0,
  }),
  momentumText: {
    fontSize: '0.8rem', color: '#22C55E', fontWeight: 600,
    marginTop: '0.35rem',
  },

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
