/**
 * MyFarmPage — standalone page at /my-farm showing farmer's farm details.
 *
 * Reads from profile context, displays farm name, crop, location, size,
 * stage, and country in a clean card layout. No internal IDs, no lat/lng,
 * no technical fields. Dark theme, inline styles, all text via useTranslation().
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
// Strict no-English-leak alias — see useStrictTranslation.js header.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getCountryLabel } from '../config/countriesStates.js';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { getAvatar, saveAvatar, removeAvatar, compressAvatar } from '../utils/avatarStorage.js';
import { SECTION_ICONS } from '../lib/farmerIcons.js';
import FarmerAvatar from '../components/FarmerAvatar.jsx';
import SupportCard from '../components/SupportCard.jsx';
import FarmInsightCard from '../components/FarmInsightCard.jsx';
// NotificationPreferencesCard + FarmerIdCard intentionally not
// imported here — both moved into the unified Settings page at
// /settings as part of the UI cleanup pass.
import DailyProgressCard from '../components/DailyProgressCard.jsx';
import CropImage from '../components/CropImage.jsx';
import CropTimelineCard from '../components/CropTimelineCard.jsx';
import HarvestCard from '../components/HarvestCard.jsx';
import VoiceButton from '../components/VoiceButton.jsx';
// Farm intelligence hub — additive sub-components. Each self-hides
// when its inputs are missing; never breaks the page.
import FarmSummaryCard from '../components/farm/FarmSummaryCard.jsx';
import FarmHealthCard from '../components/farm/FarmHealthCard.jsx';
import SmartSuggestionsCard from '../components/farm/SmartSuggestionsCard.jsx';
import QuickActionsCard from '../components/farm/QuickActionsCard.jsx';
import VerificationStatusCard from '../components/farm/VerificationStatusCard.jsx';
import FarmRecordsCard from '../components/farm/FarmRecordsCard.jsx';
import AddFarmEmpty from '../components/farm/AddFarmEmpty.jsx';
import NextBestActionCard from '../components/farm/NextBestActionCard.jsx';
// Risk-1 fix: data sources for SmartSuggestionsCard's contextual
// rules. All three already exist in the app — we just wire them
// in here so the suggestion card can fire its full rule set
// (complete-today / list-produce / check-funding) instead of
// only the legacy crop-stage rules.
import { getActiveListings } from '../market/marketStore.js';
import { getActiveFundingOpportunities } from '../funding/fundingStore.js';
import { matchFundingForFarm } from '../funding/fundingMatcher.js';
import { processNotifications } from '../lib/notifications/notificationScheduler.js';
import { getTodayTasks } from '../lib/dailyTasks/taskScheduler.js';
import {
  resolveFindBestCropRoute, destinationToUrl,
  assertFindBestCropNotOnboarding,
} from '../core/multiFarm/index.js';

// STAGE_EMOJIS and STAGE_KEYS imported from utils/cropStages.js
//
// Removed (Apr 2026 pilot fix): a local CROP_EMOJIS map +
// getCropEmoji() helper that mapped cassava/potato to the same
// 🥔 emoji (Unicode has no cassava glyph). The map and helper
// were dead code — the page already renders crop visuals via
// <CropImage> below, which reads the canonical .webp catalog
// in src/config/cropImages.js. Keeping the dead emoji map
// risked re-introducing the inconsistency.

function formatSize(size, unit) {
  if (!size && size !== 0) return null;
  const u = unit || 'acres';
  return `${size} ${u}`;
}

/**
 * localizeCountry — turn a country code or name into a human-
 * readable, locale-aware label. Tries `Intl.DisplayNames` first
 * (Node 14+ / every modern browser), falls back to the curated
 * English labels in countriesStates.js, finally to the input.
 *
 * Important: only uses Intl when the input looks like a 2-letter
 * country code. A free-form name (e.g. "United States") would
 * confuse Intl, so we pass it straight to the curated lookup.
 */
function localizeCountry(input, lang) {
  if (!input) return '';
  const value = String(input).trim();
  if (!value) return '';
  const looksLikeCode = /^[A-Za-z]{2}$/.test(value);
  if (looksLikeCode) {
    const upper = value.toUpperCase();
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        const localized = new Intl.DisplayNames([lang || 'en'], { type: 'region' }).of(upper);
        if (localized && localized !== upper) return localized;
      }
    } catch { /* Intl not supported for this locale — fall through */ }
    return getCountryLabel(upper) || upper;
  }
  // Free-form text — leave as is. The curated dataset stores
  // English labels; we don't try to translate "United States" to
  // Hindi at runtime (no clean reverse-map).
  return value;
}

export default function MyFarmPage() {
  const navigate = useNavigate();
  const { profile, farms, currentFarmId, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(getAvatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  // Risk-1 fix: capture the today-tasks plan so SmartSuggestionsCard
  // can drive its "complete today's task" rule. The existing
  // getTodayTasks() call already runs inside the notification
  // scheduler effect below — we just lift the result into state.
  const [todayTasks, setTodayTasks] = useState([]);

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatar(file);
      if (dataUrl) {
        saveAvatar(dataUrl);
        setAvatarUrl(dataUrl);
      } else {
        setAvatarError(t('avatar.compressFailed'));
      }
    } catch {
      setAvatarError(t('avatar.uploadFailed'));
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveAvatar() {
    removeAvatar();
    setAvatarUrl(null);
  }

  // Run the notification scheduler once per mount — generates
  // candidates (daily task, weather, risk, missed-task) and stores
  // the in-app ones. Safe to call on every open; dedup guarantees no
  // duplicates within the same day.
  useEffect(() => {
    if (!profile) return;
    const farmObj = profile;
    try {
      const todayPlan = getTodayTasks({
        farm: {
          id: farmObj.id, crop: farmObj.crop || farmObj.cropType,
          farmType: farmObj.farmType, cropStage: farmObj.cropStage,
          countryCode: farmObj.countryCode || farmObj.country,
        },
        weather: profile.weather || null,
      });
      const tasksList = todayPlan && Array.isArray(todayPlan.tasks)
        ? todayPlan.tasks : [];
      // Lift to state so SmartSuggestionsCard's rule set can
      // see whether today's task is still pending.
      setTodayTasks(tasksList);
      processNotifications({
        user, farm: farmObj,
        tasks: tasksList,
        weather: profile.weather || null,
        issues: profile.issues || [],
        language: profile.language || 'en',
      }).catch(() => { /* non-fatal — scheduler never breaks the page */ });
    } catch { /* ignore — scheduler is best-effort */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile && profile.id]);

  const farmerName = user?.fullName || profile?.farmerName || '';

  if (profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <span style={S.pageIcon}>{SECTION_ICONS.crop}</span>
          <h1 style={S.pageTitle}>{t('myFarm.title')}</h1>
        </div>
        <div style={S.skeletonWrap}>
          <div style={S.skeletonCard}>
            <div style={S.skeletonLine} />
            <div style={{ ...S.skeletonLine, width: '60%' }} />
            <div style={{ ...S.skeletonLine, width: '80%' }} />
            <div style={{ ...S.skeletonLine, width: '50%' }} />
          </div>
        </div>
      </div>
    );
  }

  // Empty state: no farm profile yet → render the AddFarm CTA card
  // (spec §7) instead of a blank page. Replaces the prior bare
  // `return null` so first-time farmers get a clear next step.
  if (!profile) {
    return (
      <div style={S.page} data-testid="my-farm-page-empty">
        <AddFarmEmpty />
      </div>
    );
  }

  // Use active profile as primary source (always has the current farm data),
  // fall back to farms array lookup
  const farm = profile || farms?.find((f) => f.id === currentFarmId) || farms?.[0] || null;
  const isMultiFarm = farms && farms.length > 1;

  // Risk-1 fix: pre-compute the optional inputs SmartSuggestionsCard
  // accepts. Both reads are local-only (marketStore + fundingStore
  // both keep their data in localStorage), so they're safe to run
  // on every render — no network, no async. Memoised on farm-id.
  const farmListings = useMemo(() => {
    try {
      const all = getActiveListings() || [];
      const fid = profile?.id || profile?.farmId;
      return fid ? all.filter((l) => l && l.farmId === fid) : all;
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile && (profile.id || profile.farmId)]);

  const fundingMatches = useMemo(() => {
    try {
      const opps = getActiveFundingOpportunities() || [];
      if (!profile || opps.length === 0) return [];
      return matchFundingForFarm(profile, opps) || [];
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile && (profile.id || profile.farmId)]);

  return (
    <div style={S.page} data-testid="my-farm-page">
      {/* Header */}
      <div style={S.header}>
        <span style={S.pageIcon}>{SECTION_ICONS.crop}</span>
        <h1 style={S.pageTitle}>{t('myFarm.title')}</h1>
        {/* Tap-to-hear: speaks the page title in the active language. */}
        <VoiceButton labelKey="myFarm.title" />
      </div>

      {/* Farm intelligence hub. Order matters: NextBestActionCard
          sits at the top so the farmer's first three questions are
          answered before anything else (status / what next / where
          to go). Each card self-hides when its inputs are missing
          so an empty pilot stays clean. */}
      {farm ? (
        <div style={S.intelligenceWrap}>
          <NextBestActionCard farm={farm} />
          <FarmSummaryCard
            farm={farm}
            lang={lang}
            countryLabel={localizeCountry(farm.country || farm.countryCode, lang)}
          />
          <FarmHealthCard farm={farm} />
          <SmartSuggestionsCard
            farm={farm}
            lang={lang}
            tasks={todayTasks}
            listings={farmListings}
            fundingMatches={fundingMatches}
          />
          <QuickActionsCard />
          <FarmRecordsCard farm={farm} />
          <VerificationStatusCard farm={farm} />
        </div>
      ) : null}

      {/* Farm details */}
      {farm ? (
        <div style={S.tilesWrap}>
          {/* Identity card — avatar + farm name */}
          <div style={S.identityCard}>
            <div style={S.avatarSection}>
              <FarmerAvatar
                fullName={farmerName}
                profileImageUrl={avatarUrl}
                size={64}
                onClick={() => fileInputRef.current?.click()}
                editable
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleAvatarFile}
                style={{ display: 'none' }}
              />
              <div>
                <h2 style={S.farmName}>{farm.farmName || farm.name || t('myFarm.unnamedFarm')}</h2>
                {(farm.country || farm.countryCode) && (
                  <span style={S.farmSubline}>{SECTION_ICONS.country} {localizeCountry(farm.country || farm.countryCode, lang)}</span>
                )}
              </div>
            </div>
            <div style={S.avatarActions}>
              <button onClick={() => fileInputRef.current?.click()} style={S.avatarBtn} disabled={avatarUploading}>
                {avatarUploading ? t('avatar.uploading') : avatarUrl ? t('avatar.change') : t('avatar.add')}
              </button>
              {avatarUrl && (
                <button onClick={handleRemoveAvatar} style={S.avatarRemoveBtn}>
                  {t('avatar.remove')}
                </button>
              )}
            </div>
            {avatarError && <div style={S.avatarError}>{avatarError}</div>}
          </div>

          {/* Detail tiles — 2-column grid */}
          <div style={S.tileGrid}>
            {/* Crop tile */}
            {(farm.cropType || farm.crop) && (
              <div style={S.tile}>
                <CropImage
                  cropKey={farm.cropType || farm.crop}
                  alt={getCropLabelSafe(farm.cropType || farm.crop, lang)}
                  size={56}
                  circular
                  style={{ marginBottom: '0.5rem' }}
                />
                <span style={S.tileLabel}>{t('myFarm.crop')}</span>
                <span style={S.tileValue}>{getCropLabelSafe(farm.cropType || farm.crop, lang)}</span>
              </div>
            )}

            {/* Size tile */}
            {farm.size && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{SECTION_ICONS.size}</span>
                <span style={S.tileLabel}>{t('myFarm.size')}</span>
                <span style={S.tileValue}>{formatSize(farm.size, farm.sizeUnit)}</span>
              </div>
            )}

            {/* Location tile */}
            {(farm.location || farm.locationLabel) && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{SECTION_ICONS.location}</span>
                <span style={S.tileLabel}>{t('myFarm.location')}</span>
                <span style={S.tileValue}>{farm.location || farm.locationLabel}</span>
              </div>
            )}

            {/* Stage tile */}
            {farm.cropStage && (
              <div style={S.tile}>
                <span style={S.tileIcon}>{STAGE_EMOJIS[farm.cropStage] || '📊'}</span>
                <span style={S.tileLabel}>{t('myFarm.stage')}</span>
                <span style={S.stageBadge}>
                  {t(STAGE_KEYS[farm.cropStage]) || farm.cropStage.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={S.actionsRow}>
            <button
              type="button"
              onClick={() => {
                const dest = resolveFindBestCropRoute({ profile, farms });
                const url = destinationToUrl(dest);
                // Dev-only guard: existing users must NEVER be sent to
                // /onboarding/* via this button. resolveFindBestCropRoute
                // should have already enforced that — the assertion is
                // belt-and-braces for future regressions.
                assertFindBestCropNotOnboarding(!!profile?.id, url);
                navigate(url);
              }}
              style={S.cropFitBtn}
            >
              {'\uD83C\uDF3E'} {t('myFarm.findBestCrop')}
            </button>
            <button
              type="button"
              onClick={() => {
                // Always pass the current farm id so Edit targets the
                // right record in a multi-farm world. The screen pulls
                // the farm from ProfileContext using this id.
                const farmId = currentFarmId || profile?.id;
                navigate(farmId ? `/edit-farm?farmId=${encodeURIComponent(farmId)}` : '/edit-farm');
              }}
              style={S.editBtn}
            >
              {t('myFarm.edit')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/farm/new')}
              style={S.editBtn}
              data-testid="my-farm-add-new"
            >
              {'\u2795'} {t('myFarm.addNewFarm')}
            </button>
            {isMultiFarm && (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={S.switchBtn}
              >
                {t('myFarm.switchFarm')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={S.emptyWrap}>
          <p style={S.emptyText}>{t('myFarm.noFarm')}</p>
          <button
            type="button"
            onClick={() => navigate('/onboarding/fast')}
            style={S.editBtn}
          >
            {t('myFarm.setupFarm')}
          </button>
        </div>
      )}

      {/* Crop timeline — journey, current stage, next stage, days left */}
      {farm && <CropTimelineCard farm={farm} />}

      {/* Harvest — capture form when ready, summary once recorded */}
      {farm && <HarvestCard farm={farm} />}

      {/* Daily progress — streak, score, next action, milestones */}
      {farm && (
        <DailyProgressCard
          farm={farm}
          user={user}
          issues={profile?.issues || []}
          risk={profile?.risk || null}
        />
      )}

      {/* Risk-5 fix: TodaysTasksCard removed from this page.
          The new NextBestActionCard at the top of the
          intelligence hub now owns "today's task" surfacing
          (it reads from the same getTodayTasks source). The
          dedicated /tasks page is one tap away via the bottom
          nav and the NextBestActionCard CTA. */}

      {/* Farm intelligence — yield / value / weather-action / risk cards */}
      {farm && (
        <FarmInsightCard
          farm={farm}
          weather={profile?.weather || null}
          tasks={profile?.tasks || []}
          issues={profile?.issues || []}
        />
      )}

      {/*
        NotificationPreferencesCard + FarmerIdCard removed — both
        moved into /settings (Settings page). The gear icon in
        FarmerHeader is the entry point. Help/support stays here so
        farmers reach it without leaving the farm view.
      */}
      <div style={S.cardWrap}>
        <SupportCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 1rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: {
    fontSize: '1.25rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
  },
  tilesWrap: {
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  intelligenceWrap: {
    padding: '0.5rem 1.25rem 0',
    display: 'flex',
    flexDirection: 'column',
  },
  cardWrap: {
    padding: '0 1.25rem 0.75rem',
  },
  identityCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '20px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  avatarActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  avatarBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9FB3C8',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarRemoveBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6F8299',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarError: {
    fontSize: '0.75rem',
    color: '#FCA5A5',
    marginTop: '0.25rem',
  },
  farmName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
    lineHeight: 1.3,
  },
  farmSubline: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 500,
    marginTop: '0.125rem',
    display: 'block',
  },
  // ─── Tile grid ──────────
  tileGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.625rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '1.125rem 0.75rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    textAlign: 'center',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  tileIcon: {
    fontSize: '1.5rem',
    marginBottom: '0.125rem',
  },
  tileLabel: {
    fontSize: '0.625rem',
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  tileValue: {
    fontSize: '0.9375rem',
    color: '#EAF2FF',
    fontWeight: 600,
  },
  stageBadge: {
    display: 'inline-block',
    fontSize: '0.8125rem',
    color: '#EAF2FF',
    fontWeight: 600,
    padding: '0.125rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    textTransform: 'capitalize',
  },
  actionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cropFitBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: '1px solid rgba(34,197,94,0.2)',
    background: 'rgba(34,197,94,0.06)',
    color: '#22C55E',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  editBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.1s ease, box-shadow 0.15s ease',
  },
  switchBtn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1.5rem',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '0.9375rem',
    color: '#9FB3C8',
    margin: '0 0 1.25rem 0',
    lineHeight: 1.5,
  },
  skeletonWrap: {
    padding: '1.25rem',
  },
  skeletonCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '20px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  skeletonLine: {
    height: '1rem',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
};
