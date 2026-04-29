/**
 * MyFarmPage — standalone page at /my-farm showing farmer's farm details.
 *
 * Reads from profile context, displays farm name, crop, location, size,
 * stage, and country in a clean card layout. No internal IDs, no lat/lng,
 * no technical fields. Dark theme, inline styles, all text via useTranslation().
 */

// Spec §10 simplification (Apr 2026): MyFarm now renders only
// the spec'd 4 sections — Next Task / Farm Status + details /
// Quick Actions / Help. The heavy intelligence hub
// (FarmSummary, FarmHealth, SmartSuggestions, FarmRecords,
// VerificationStatus) + identity card + 4-tile grid + multiple
// secondary cards (FarmInsight, CropTimeline, Harvest,
// DailyProgress) + multi-button action row (Find Best Crop /
// Add New Farm / Switch Farm) were removed from this page.
// They aren't deleted from the codebase — just not surfaced
// here. Each lives in a more specific home (Progress tab,
// Profile/Trust page, Settings) per spec instructions.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
// Strict no-English-leak alias — see useStrictTranslation.js header.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { getCountryLabel } from '../config/countriesStates.js';
import { getCropLabelSafe } from '../utils/crops.js';
import { STAGE_KEYS } from '../utils/cropStages.js';
// Farm helpers — getFarmStatus returns the 3-state code
// (on_track / needs_attention / setup_incomplete) the new
// status section maps onto Good / Needs attention / Setup
// incomplete per spec §3.
import {
  getFarmStatus, FARM_STATUS,
} from '../lib/farm/farmFallbacks.js';
import QuickActionsCard from '../components/farm/QuickActionsCard.jsx';
import AddFarmEmpty from '../components/farm/AddFarmEmpty.jsx';
import NextBestActionCard from '../components/farm/NextBestActionCard.jsx';
import { processNotifications } from '../lib/notifications/notificationScheduler.js';
import { getTodayTasks } from '../lib/dailyTasks/taskScheduler.js';

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
  const { t, lang } = useTranslation();
  // Today's tasks feed both NextBestActionCard (via its own
  // internal read) and our local farm-status derivation.
  const [todayTasks, setTodayTasks] = useState([]);

  // Run the notification scheduler once per mount + capture
  // today's tasks for status derivation. Same logic the page
  // had before — only the avatar / auth side-effects were
  // dropped along with the rendered avatar card.
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
      setTodayTasks(tasksList);
      processNotifications({
        user: null, farm: farmObj,
        tasks: tasksList,
        weather: profile.weather || null,
        issues: profile.issues || [],
        language: profile.language || 'en',
      }).catch(() => { /* non-fatal — scheduler never breaks the page */ });
    } catch { /* ignore — scheduler is best-effort */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile && profile.id]);

  if (profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.simpleHeader}>
          <h1 style={S.simpleTitle}>{t('myFarm.title')}</h1>
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
  // (spec §7) instead of a blank page.
  if (!profile) {
    return (
      <div style={S.page} data-testid="my-farm-page-empty">
        <AddFarmEmpty />
      </div>
    );
  }

  // Use active profile as primary source (always has the current farm data),
  // fall back to farms array lookup. Other-farms switching moved
  // to a dedicated /farm settings surface per spec.
  const farm = profile || farms?.find((f) => f.id === currentFarmId) || farms?.[0] || null;

  // SmartSuggestionsCard's listings/funding inputs were used by
  // the prior intelligence hub; the simplified spec drops that
  // surface so we no longer compute them here. The data still
  // lives in marketStore + fundingStore for any caller that
  // needs it.

  // ─── Farm Status (per spec §3) ──────────────────────────
  // Reuses existing getFarmStatus helper which returns the same
  // 3-state code spec asks for: on_track / needs_attention /
  // setup_incomplete. Mapped to: Good / Needs attention / Setup
  // incomplete. Progress bar percentage is derived from the
  // status code so the calm UX never "flashes" between numbers.
  const status = getFarmStatus(farm, todayTasks, null);
  const statusPct = status.code === FARM_STATUS.ON_TRACK ? 80
                  : status.code === FARM_STATUS.NEEDS_ATTENTION ? 50
                  : 25;
  const statusTone = status.code === FARM_STATUS.ON_TRACK ? '#22C55E'
                   : status.code === FARM_STATUS.NEEDS_ATTENTION ? '#F59E0B'
                   : '#9FB3C8';

  // Per-row farm details — only render rows whose data is set.
  // Avoids "Unknown" strings; an unset field simply hides.
  const cropValue = (farm.crop || farm.cropType)
    ? getCropLabelSafe(farm.crop || farm.cropType, lang) : null;
  const sizeValue = farm.size
    ? formatSize(farm.size, farm.sizeUnit) : null;
  const locationValue = farm.location || farm.locationLabel
    || localizeCountry(farm.country || farm.countryCode, lang) || null;
  const stageValue = farm.cropStage
    ? (t(STAGE_KEYS[farm.cropStage]) || farm.cropStage.replace(/_/g, ' ')) : null;

  const farmId = currentFarmId || profile?.id;
  const editFarmUrl = farmId
    ? `/edit-farm?farmId=${encodeURIComponent(farmId)}`
    : '/edit-farm';

  return (
    <div style={S.page} data-testid="my-farm-page">
      {/* ─── 1. Header (per spec §1) ─────────────────────────
          Just the title — bell deferred since this codebase's
          NotificationBell lives on FarmerTodayPage / Layout
          chrome rather than per-page. Title-only header keeps
          the page short per spec §9 (avoid long scroll). */}
      <div style={S.simpleHeader}>
        <h1 style={S.simpleTitle}>{t('myFarm.title')}</h1>
      </div>

      {/* ─── 2. Next Task Card (per spec §2) ────────────────
          NextBestActionCard already implements the spec exactly
          — title, instruction, primary "Open Task" CTA, and
          falls back to "Check your farm today" when no task is
          available. Reuse it instead of inlining. */}
      {farm && <NextBestActionCard farm={farm} />}

      {/* ─── 3. Farm Status + Details (per spec §3-4) ───────
          Single card combining the status pill + progress bar +
          one-sentence summary AND the 4 detail rows. Replaces
          the old Identity card + 4-tile grid + FarmHealthCard
          stack — same data, much less visual noise. */}
      {farm && (
        <section style={S.statusCard} data-testid="my-farm-status">
          <div style={S.statusRow}>
            <span style={{ ...S.statusPill, color: statusTone, borderColor: statusTone + '55' }}>
              {tSafe(status.key, status.fallback)}
            </span>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${statusPct}%`, background: statusTone }} />
            </div>
          </div>
          <p style={S.statusLine}>
            {status.code === FARM_STATUS.ON_TRACK
              ? tSafe('myFarm.status.line.good',
                  'You\u2019re making good progress.')
              : status.code === FARM_STATUS.NEEDS_ATTENTION
                ? tSafe('myFarm.status.line.needsAttention',
                    'Complete today\u2019s task to stay on track.')
                : tSafe('myFarm.status.line.setupIncomplete',
                    'Update your farm details for better guidance.')}
          </p>
          <ul style={S.detailList}>
            {cropValue && (
              <li style={S.detailRow}>
                <span style={S.detailLabel}>{t('myFarm.crop')}</span>
                <span style={S.detailValue}>{cropValue}</span>
              </li>
            )}
            {sizeValue && (
              <li style={S.detailRow}>
                <span style={S.detailLabel}>{t('myFarm.size')}</span>
                <span style={S.detailValue}>{sizeValue}</span>
              </li>
            )}
            {locationValue && (
              <li style={S.detailRow}>
                <span style={S.detailLabel}>{t('myFarm.location')}</span>
                <span style={S.detailValue}>{locationValue}</span>
              </li>
            )}
            {stageValue && (
              <li style={S.detailRow}>
                <span style={S.detailLabel}>{t('myFarm.stage')}</span>
                <span style={S.detailValue}>{stageValue}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ─── 5. Quick Actions (per spec §5, max 3) ──────────
          QuickActionsCard now ships only 3 actions (Update Farm,
          Sell Produce, View Funding). Scan Crop is hidden by
          default since the spec gates it on "feature already
          works" — a future toggle in QuickActionsCard can
          re-enable it without touching this page. */}
      {farm && <QuickActionsCard />}

      {/* ─── 6. Compact Help (per spec §6) ──────────────────
          Single-tap help: title + one line + Contact Us button.
          NO subject / message form fields — those moved to a
          dedicated /support route in earlier work. */}
      {farm && (
        <section style={S.helpCard} data-testid="my-farm-help">
          <div>
            <h2 style={S.helpTitle}>
              {tSafe('myFarm.help.title', 'Need help?')}
            </h2>
            <p style={S.helpLead}>
              {tSafe('myFarm.help.lead', 'Chat with our team.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/support')}
            style={S.helpBtn}
            data-testid="my-farm-help-contact"
          >
            {tSafe('myFarm.help.contact', 'Contact Us')}
          </button>
        </section>
      )}

      {/* ─── 7. Empty state (per spec §7) ───────────────────
          Single setup CTA. AddFarmEmpty already implements the
          calm "Set up your farm" card — reused here so first-
          time farmers see exactly one clear next step (no
          progress / records / verification stubs). */}
      {!farm && (
        <div style={S.emptyWrap} data-testid="my-farm-empty">
          <AddFarmEmpty />
        </div>
      )}

      {/* Single Edit shortcut at the bottom — per spec the only
          farm-mutating action that stays on this screen.
          Add/switch/find-best-crop moved to dedicated surfaces. */}
      {farm && (
        <div style={S.editRow}>
          <button
            type="button"
            onClick={() => navigate(editFarmUrl)}
            style={S.editLink}
            data-testid="my-farm-edit"
          >
            {t('myFarm.edit')}
          </button>
        </div>
      )}
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

  // ─── Simplified spec layout (Apr 2026 pilot fix) ─────────
  // Slim header without the section icon — keeps the page
  // short per spec §9 (avoid long scroll). Older verbose
  // header / pageIcon styles are retained for the loading
  // skeleton path elsewhere on this file.
  simpleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem 0.5rem',
  },
  simpleTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
  },

  // Single Farm Status card combining status pill + progress
  // bar + sentence + 4 detail rows (per spec §3-4). Same navy
  // farmer palette as the rest of the app.
  statusCard: {
    margin: '0.5rem 1rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 14,
    padding: '0.95rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  statusPill: {
    flex: '0 0 auto',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
  },
  progressTrack: {
    flex: '1 1 auto',
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.4s ease',
  },
  statusLine: {
    margin: 0,
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.875rem',
    lineHeight: 1.45,
  },
  detailList: {
    listStyle: 'none',
    margin: '0.25rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: '0.6rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '4px 0',
    fontSize: '0.875rem',
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 600,
    flex: '0 0 auto',
  },
  detailValue: {
    color: '#FFFFFF',
    fontWeight: 600,
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Compact help card (per spec §6) — title + lead + single
  // Contact Us button. No subject/message form fields.
  helpCard: {
    margin: '0.75rem 1rem 0',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 14,
    padding: '0.95rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  helpTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  helpLead: {
    margin: '2px 0 0',
    fontSize: '0.825rem',
    color: 'rgba(255,255,255,0.65)',
  },
  helpBtn: {
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.55)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
    flex: '0 0 auto',
  },

  // Bottom Edit shortcut — secondary navy ghost link.
  editRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0.75rem 1rem 1.5rem',
  },
  editLink: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.72)',
    borderRadius: 10,
    padding: '8px 16px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 36,
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
