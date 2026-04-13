import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeTrackEvent } from '../lib/analytics.js';
import { languageToVoiceCode, speakText } from '../lib/voice.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';
import { getLandBoundaries, getSeedScans } from '../lib/api.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useSeason } from '../context/SeasonContext.jsx';
import FarmerIdCard from '../components/FarmerIdCard.jsx';
import PrimaryFarmActionCard from '../components/PrimaryFarmActionCard.jsx';
import FarmReadinessCard from '../components/FarmReadinessCard.jsx';
import WeatherDecisionCard from '../components/WeatherDecisionCard.jsx';
import ActionRecommendationsCard from '../components/ActionRecommendationsCard.jsx';
import FarmSnapshotCard from '../components/FarmSnapshotCard.jsx';
import VoicePromptButton from '../components/VoicePromptButton.jsx';
import SeasonTasksCard from '../components/SeasonTasksCard.jsx';
import SupportCard from '../components/SupportCard.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import FarmSwitcher from '../components/FarmSwitcher.jsx';
import FarmPicker from '../components/FarmPicker.jsx';

// Lazy-load advanced features — keep initial bundle small for low-end devices
const LandBoundaryCapture = lazy(() => import('../components/LandBoundaryCapture.jsx'));
const SeedScanFlow = lazy(() => import('../components/SeedScanFlow.jsx'));
const SellReadinessInput = lazy(() => import('../components/SellReadinessInput.jsx'));

export default function Dashboard() {
  const { autoVoice, language } = useAppPrefs();
  const { user, authLoading } = useAuth();
  const { profile, profileLoading, activeFarms } = useProfile();
  const { season, refreshSeason } = useSeason();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { isOnline } = useNetwork();
  const farmScore = calculateFarmScore(profile || {});
  const setupComplete = farmScore.isReady === true;

  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);
  const [boundaries, setBoundaries] = useState([]);
  const [seedScans, setSeedScans] = useState([]);

  const hasMultipleFarms = activeFarms && activeFarms.length > 1;

  // Non-blocking fetch — only when online and setup complete
  const loadBoundariesAndScans = useCallback(async () => {
    if (!setupComplete || !isOnline) return;
    try {
      const [bData, sData] = await Promise.all([getLandBoundaries(), getSeedScans()]);
      setBoundaries(bData.boundaries || []);
      setSeedScans(sData.scans || []);
    } catch { /* non-blocking — never affects core flow */ }
  }, [setupComplete, isOnline]);

  useEffect(() => {
    safeTrackEvent('dashboard.viewed', {});
  }, []);

  useEffect(() => { loadBoundariesAndScans(); }, [loadBoundariesAndScans]);

  useEffect(() => {
    if (autoVoice) {
      speakText(
        'Welcome. Check your farmer ID, your next action, today\'s work, weather, and farm details.',
        languageToVoiceCode(language),
      );
    }
  }, [autoVoice, language]);

  if (authLoading || profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingWrap}>
            <div style={S.loadingText}>{t('dashboard.loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Welcome Header */}
        <div style={S.card}>
          <div style={S.headerRow}>
            <div>
              <h1 style={S.welcomeTitle}>
                {t('dashboard.welcome')}{user?.fullName ? `, ${user.fullName}` : ''}
              </h1>
              <p style={S.email}>{user?.email || ''}</p>
              <p style={S.hint}>
                {t('dashboard.hint')}
              </p>
            </div>
            <VoicePromptButton
              text={t('dashboard.voiceGuide')}
              label={t('dashboard.playGuidance')}
            />
          </div>
        </div>

        {!setupComplete && profile && (
          <div style={S.setupBanner}>
            <div>
              <div style={S.bannerTitle}>{t('dashboard.setupBanner')}</div>
              <div style={S.bannerDesc}>{t('dashboard.setupBannerDesc')}</div>
            </div>
            <button onClick={() => navigate('/profile/setup')} style={S.bannerBtn}>
              {t('dashboard.completeSetup')}
            </button>
          </div>
        )}

        {/* ─── Add Update — primary action button ──────────── */}
        {setupComplete && season && (
          <button
            onClick={() => {
              if (hasMultipleFarms) {
                setShowFarmPicker(true);
              } else {
                setSelectedUpdateFarm(profile);
                setShowUpdateFlow(true);
              }
            }}
            style={S.addUpdateBtn}
            data-testid="add-update-btn"
          >
            <span style={S.addUpdateIcon}>📸</span>
            <span>{t('update.addUpdate')}</span>
          </button>
        )}

        {/* ─── Farm picker for multi-farm update ──────────── */}
        {showFarmPicker && (
          <div style={S.modalOverlay}>
            <div style={S.modalContent}>
              <FarmPicker
                onSelect={(farm) => {
                  setSelectedUpdateFarm(farm);
                  setShowFarmPicker(false);
                  setShowUpdateFlow(true);
                }}
                onCancel={() => setShowFarmPicker(false)}
              />
            </div>
          </div>
        )}

        {/* ─── Quick Update modal overlay ──────────────────── */}
        {showUpdateFlow && (
          <div style={S.modalOverlay}>
            <div style={S.modalContent}>
              <QuickUpdateFlow
                seasonId={season?.id}
                farmerId={selectedUpdateFarm?.id || profile?.id}
                farmName={selectedUpdateFarm?.farmName}
                seasonStage={season?.stage}
                entries={season?.entries || []}
                onComplete={() => {
                  setShowUpdateFlow(false);
                  setSelectedUpdateFarm(null);
                  refreshSeason();
                }}
                onCancel={() => {
                  setShowUpdateFlow(false);
                  setSelectedUpdateFarm(null);
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Farm switcher — only visible with 2+ farms ──── */}
        <FarmSwitcher />

        <FarmerIdCard />

        <PrimaryFarmActionCard />

        {setupComplete && <SeasonTasksCard />}

        {setupComplete && <WeatherDecisionCard />}

        {setupComplete && <ActionRecommendationsCard />}

        <FarmReadinessCard />

        {setupComplete && (
          <Suspense fallback={null}>
            <div style={S.card}>
              <LandBoundaryCapture
                existingBoundary={boundaries[0] || null}
                onSaved={(b) => setBoundaries((prev) => [b, ...prev])}
              />
            </div>
          </Suspense>
        )}

        {setupComplete && (
          <Suspense fallback={null}>
            <div style={S.card}>
              <SeedScanFlow
                existingScans={seedScans}
                onSaved={(s) => setSeedScans((prev) => [s, ...prev])}
              />
            </div>
          </Suspense>
        )}

        {setupComplete && (
          <Suspense fallback={null}>
            <div style={S.card}>
              <SellReadinessInput />
            </div>
          </Suspense>
        )}

        <FarmSnapshotCard />

        <SupportCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  welcomeTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: 0,
  },
  email: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  hint: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.5rem',
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
  },
  loadingText: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)',
  },
  setupBanner: {
    borderRadius: '16px',
    background: 'rgba(250,204,21,0.1)',
    border: '1px solid rgba(250,204,21,0.3)',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  bannerTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#FDE68A',
  },
  bannerDesc: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.65)',
    marginTop: '0.25rem',
  },
  bannerBtn: {
    borderRadius: '12px',
    background: '#FBBF24',
    padding: '0.625rem 1.25rem',
    fontWeight: 700,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
  },
  addUpdateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '1.1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '16px',
    fontSize: '1.15rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '60px',
    boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },
  addUpdateIcon: {
    fontSize: '1.4rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0',
  },
  modalContent: {
    width: '100%',
    maxWidth: '480px',
    maxHeight: '95vh',
    overflowY: 'auto',
    borderRadius: '16px 16px 0 0',
    WebkitOverflowScrolling: 'touch',
  },
};
