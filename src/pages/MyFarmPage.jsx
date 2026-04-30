/**
 * MyFarmPage — premium farm control panel at /my-farm.
 *
 * Layout (Apr 2026 polish spec):
 *   1. Header             — "My Farm" + sprout icon
 *   2. Farm Selector      — FarmSwitcher dropdown (green accent)
 *   3. Setup Card         — only when crop/location/size missing
 *   4. Farm Details Card  — Crop / Location / Size / Stage rows
 *                            (each with icon + label + value)
 *   5. Action Buttons     — Edit Farm + Add New Farm (exactly two)
 *   6. Help Card          — "Need help? Contact our team →"
 *
 * Removed from this page (per spec §8):
 *   • Today's Action card (NextBestActionCard) — owned by Home/Tasks
 *   • Funding / Sell / Scan crop / Check land / Progress / Records
 *   • Verification block / Long suggestions / Help form fields
 *   • Duplicate setup messages
 *
 * The page is intentionally short — farm control panel only. Daily
 * actions live on Home (/dashboard) and Tasks (/tasks); selling on
 * /sell; funding on /opportunities. We keep them off this page so
 * each surface has a single role (screen-role refactor).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
// Strict no-English-leak alias — see useStrictTranslation.js header.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { getCountryLabel } from '../config/countriesStates.js';
import { getCropLabelSafe } from '../utils/crops.js';
import { STAGE_KEYS } from '../utils/cropStages.js';
import AddFarmEmpty from '../components/farm/AddFarmEmpty.jsx';
import FarmSwitcher from '../components/farm/FarmSwitcher.jsx';
import {
  Sprout, Wheat, MapPin, Ruler, Calendar, HelpCircle, Plus, ArrowRight,
} from '../components/icons/lucide.jsx';
import { processNotifications } from '../lib/notifications/notificationScheduler.js';
import { getTodayTasks } from '../lib/dailyTasks/taskScheduler.js';

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
  return value;
}

export default function MyFarmPage() {
  const navigate = useNavigate();
  const {
    profile, farms, currentFarmId, loading: profileLoading,
  } = useProfile();
  const { t, lang } = useTranslation();

  // Today's-tasks scheduler runs as a side effect to feed the
  // notification scheduler — same logic the page had before. The
  // tasks themselves are NOT rendered here anymore (Home/Tasks
  // own that surface); we just kick the scheduler.
  const [, setTodayTasks] = useState([]);
  useEffect(() => {
    if (!profile) return;
    const farmObj = profile;
    try {
      const todayPlan = getTodayTasks({
        farm: {
          id: farmObj.id, crop: farmObj.crop,
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
        <Header t={t} />
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

  // Empty state: no farm profile yet → render the AddFarm CTA card.
  if (!profile) {
    return (
      <div style={S.page} data-testid="my-farm-page-empty">
        <Header t={t} />
        <AddFarmEmpty />
      </div>
    );
  }

  // Active farm — prefer profile (always carries the current farm
  // data), fall back to the farms array lookup.
  const farm = profile || farms?.find((f) => f.id === currentFarmId) || farms?.[0] || null;

  // Per-row farm details — values are non-null defaults per spec
  // (no "No data" leaks; missing fields show "Add location" etc.).
  const cropValue = farm.crop
    ? getCropLabelSafe(farm.crop, lang)
    : tSafe('myFarm.notSelected', 'Not selected');
  const sizeValue = farm.size
    ? formatSize(farm.size, farm.sizeUnit)
    : tSafe('myFarm.addSize', 'Add farm size');
  const locationValue = farm.location || farm.locationLabel
    || localizeCountry(farm.country || farm.countryCode, lang)
    || tSafe('myFarm.addLocation', 'Add location');
  const stageValue = farm.cropStage
    ? (t(STAGE_KEYS[farm.cropStage]) || farm.cropStage.replace(/_/g, ' '))
    : tSafe('myFarm.planning', 'Planning');

  const farmId = currentFarmId || profile?.id;
  const editFarmUrl = farmId
    ? `/edit-farm?farmId=${encodeURIComponent(farmId)}`
    : '/edit-farm';

  // Setup-completeness signal. Considered complete when the three
  // user-supplied fields the recommendation engine needs are all
  // present (crop + location + size). Stage isn't required — it
  // can be derived from a planting date later.
  const setupIncomplete = !farm.crop
                       || !(farm.location || farm.locationLabel
                              || farm.country || farm.countryCode)
                       || !farm.size;

  function handleHelpClick() {
    // Try the in-app /support route first; if the URL hasn't
    // changed within a beat, fall back to a mailto. This avoids
    // both dead clicks and double-firing on a real /support route.
    const before = (typeof window !== 'undefined' && window.location)
      ? String(window.location.pathname || '') : '';
    try { navigate('/support'); }
    catch {
      try {
        if (typeof window !== 'undefined') {
          window.location.href = 'mailto:support@farroway.app';
        }
      } catch { /* never propagate */ }
      return;
    }
    setTimeout(() => {
      try {
        const after = (typeof window !== 'undefined' && window.location)
          ? String(window.location.pathname || '') : '';
        if (after === before && typeof window !== 'undefined') {
          window.location.href = 'mailto:support@farroway.app';
        }
      } catch { /* never propagate */ }
    }, 120);
  }

  return (
    <div style={S.page} data-testid="my-farm-page">
      {/* ── 1. Header (spec §1) ─────────────────────────────── */}
      <Header t={t} />

      {/* ── 2. Farm Selector (spec §2) ─────────────────────────
          Reuses the existing FarmSwitcher — single-farm farms
          render a static label (dropdown disabled but visible);
          multi-farm households open a popover with switch +
          add + manage. Recently restyled with a sprout leading
          icon + green accent border. */}
      <FarmSwitcher />

      {/* ── 3. Setup Card (spec §3) ────────────────────────────
          Single unified card; renders ONLY when the farm is
          missing crop/location/size. Replaces the prior split
          messages (avoids "duplicated setup messages" — spec §8). */}
      {setupIncomplete && (
        <section style={S.setupCard} data-testid="my-farm-setup-card">
          <span style={S.setupBadge}>
            {tSafe('myFarm.setupBadge', 'Setup incomplete')}
          </span>
          <h2 style={S.setupTitle}>
            {tSafe('myFarm.setupTitle', 'Complete your farm setup')}
          </h2>
          <p style={S.setupBody}>
            {tSafe('myFarm.setupBody',
              'Add crop, location, and farm size to get personalized tasks and smart guidance.')}
          </p>
          <button
            type="button"
            onClick={() => navigate(editFarmUrl)}
            style={S.setupCta}
            data-testid="my-farm-setup-cta"
          >
            <span>{tSafe('myFarm.setupCta', 'Complete setup')}</span>
            <span aria-hidden="true" style={{ display: 'inline-flex', marginLeft: 8 }}>
              <ArrowRight size={16} />
            </span>
          </button>
        </section>
      )}

      {/* ── 4. My Farm Details (spec §4) ───────────────────────
          Premium detail block: title with Edit pill top-right,
          then 4 rows (Crop / Location / Size / Stage). Each row
          is icon + label + value. No "No data" — defaults like
          "Not selected" / "Add location" replace empty fields. */}
      <section style={S.detailsCard} data-testid="my-farm-details">
        <div style={S.detailsHead}>
          <h2 style={S.detailsTitle}>
            {tSafe('myFarm.details.title', 'My Farm Details')}
          </h2>
          <button
            type="button"
            onClick={() => navigate(editFarmUrl)}
            style={S.detailsEditBtn}
            data-testid="my-farm-details-edit"
          >
            {tSafe('myFarm.edit.short', 'Edit')}
          </button>
        </div>
        <ul style={S.detailList}>
          <DetailRow
            icon={<Wheat size={16} />}
            label={t('myFarm.crop')}
            value={cropValue}
            placeholder={!farm.crop}
          />
          <DetailRow
            icon={<MapPin size={16} />}
            label={t('myFarm.location')}
            value={locationValue}
            placeholder={!(farm.location || farm.locationLabel
                          || farm.country || farm.countryCode)}
          />
          <DetailRow
            icon={<Ruler size={16} />}
            label={t('myFarm.size')}
            value={sizeValue}
            placeholder={!farm.size}
          />
          <DetailRow
            icon={<Calendar size={16} />}
            label={t('myFarm.stage')}
            value={stageValue}
            placeholder={!farm.cropStage}
          />
        </ul>
      </section>

      {/* ── 5. Action Buttons (spec §5) ────────────────────────
          Exactly two large action buttons, full-width each.
          Edit Farm = primary navy; Add New Farm = green accent.
          Funding / Sell / Scan / Check land are intentionally
          omitted — they live in their own surfaces (spec §8). */}
      <div style={S.actionStack} data-testid="my-farm-actions">
        <button
          type="button"
          onClick={() => navigate(editFarmUrl)}
          style={S.actionBtnPrimary}
          data-testid="my-farm-edit"
        >
          <span style={S.actionBtnIcon} aria-hidden="true">
            <Sprout size={16} />
          </span>
          <span>{tSafe('myFarm.edit', 'Edit Farm')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/farm/new')}
          style={S.actionBtnSecondary}
          data-testid="my-farm-add"
        >
          <span style={S.actionBtnIcon} aria-hidden="true">
            <Plus size={16} />
          </span>
          <span>{tSafe('myFarm.addFarm', 'Add New Farm')}</span>
        </button>
      </div>

      {/* ── 6. Help Card (spec §6) ─────────────────────────────
          Compact card: headset/help icon on the left, "Need
          help?" + sub-line, "Contact our team →" on the right.
          Click tries /support first, mailto: fallback if that
          route isn't mounted. Never a dead click. */}
      <button
        type="button"
        onClick={handleHelpClick}
        style={S.helpCard}
        data-testid="my-farm-help"
      >
        <span style={S.helpCardIcon} aria-hidden="true">
          <HelpCircle size={20} />
        </span>
        <span style={S.helpCardText}>
          <span style={S.helpCardTitle}>
            {tSafe('myFarm.help.title', 'Need help?')}
          </span>
          <span style={S.helpCardSub}>
            {tSafe('myFarm.help.sub', 'We\u2019re here to support you.')}
          </span>
        </span>
        <span style={S.helpCardAction}>
          {tSafe('myFarm.help.contactRow', 'Contact our team')}
          <span aria-hidden="true" style={{ marginLeft: 6 }}>
            <ArrowRight size={14} />
          </span>
        </span>
      </button>

      {/* Bottom spacer so the bottom-nav doesn't cover the help
          card on phones with translucent nav (spec §7 mobile rule). */}
      <div style={S.bottomSpacer} aria-hidden="true" />
    </div>
  );
}

// ─── Local components ──────────────────────────────────────────

function Header({ t }) {
  return (
    <div style={S.header}>
      <span style={S.headerIcon} aria-hidden="true">
        <Sprout size={20} />
      </span>
      <h1 style={S.headerTitle}>{t('myFarm.title')}</h1>
    </div>
  );
}

function DetailRow({ icon, label, value, placeholder }) {
  return (
    <li style={S.detailRow}>
      <span style={S.detailLeft}>
        <span style={S.detailIcon} aria-hidden="true">{icon}</span>
        <span style={S.detailLabel}>{label}</span>
      </span>
      <span
        style={{
          ...S.detailValue,
          ...(placeholder ? S.detailValuePlaceholder : null),
        }}
      >
        {value}
      </span>
    </li>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 1.5rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },

  // ── Header (spec §1) ────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '1rem 1.25rem 0.75rem',
  },
  headerIcon: {
    color: '#22C55E',
    display: 'inline-flex',
    alignItems: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
  },

  // ── Setup Card (spec §3) ────────────────────────────────────
  setupCard: {
    margin: '0.75rem 1rem 0',
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 14,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0 6px 18px rgba(34,197,94,0.06)',
  },
  setupBadge: {
    alignSelf: 'flex-start',
    fontSize: '0.625rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#FB923C',
    background: 'rgba(251,146,60,0.12)',
    border: '1px solid rgba(251,146,60,0.30)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  setupTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  setupBody: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.45,
  },
  setupCta: {
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: '0.8rem 1rem',
    marginTop: 4,
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(34,197,94,0.22)',
  },

  // ── Farm Details Card (spec §4) ─────────────────────────────
  detailsCard: {
    margin: '0.75rem 1rem 0',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 14,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  detailsHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  detailsTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  detailsEditBtn: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    borderRadius: 999,
    padding: '5px 14px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
    flex: '0 0 auto',
  },
  detailList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    fontSize: '0.875rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  detailLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: '1 1 auto',
  },
  detailIcon: {
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: 600,
  },
  detailValue: {
    color: '#FFFFFF',
    fontWeight: 600,
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '0 1 auto',
    maxWidth: '60%',
  },
  // Placeholder values ("Add location", "Not selected") render
  // muted so the eye glides past them — but they're never the
  // word "No data" (spec §8).
  detailValuePlaceholder: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 500,
    fontStyle: 'italic',
  },

  // ── Action Buttons (spec §5) ────────────────────────────────
  actionStack: {
    margin: '0.75rem 1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionBtnPrimary: {
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: '0.8rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 8px 20px rgba(34,197,94,0.20)',
  },
  actionBtnSecondary: {
    width: '100%',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#86EFAC',
    borderRadius: 12,
    padding: '0.8rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnIcon: {
    display: 'inline-flex',
    alignItems: 'center',
  },

  // ── Help Card (spec §6) ─────────────────────────────────────
  helpCard: {
    width: 'calc(100% - 2rem)',
    margin: '1rem 1rem 0',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '0.8rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    color: '#FFFFFF',
    minHeight: 56,
    textAlign: 'left',
  },
  helpCardIcon: {
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
  },
  helpCardText: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minWidth: 0,
    gap: 2,
  },
  helpCardTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  helpCardSub: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
  },
  helpCardAction: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#86EFAC',
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  },

  // Bottom spacer — keeps the help card off the bottom nav.
  bottomSpacer: { height: '4rem' },

  // ── Skeleton ────────────────────────────────────────────────
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
