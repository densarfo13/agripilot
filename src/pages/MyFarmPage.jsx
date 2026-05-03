/**
 * MyFarmPage — clean farm control panel at /my-farm.
 *
 * Redesign (Apr 2026 — spec "Redesign MyFarm.jsx" §1–§8):
 *   1. Header             — "My Farm" + sprout icon
 *   2. Farm Selector      — FarmSwitcher dropdown
 *   3. Farm Identity Card — circular photo + name + location +
 *                            "Upload photo" CTA. NEW per spec §3.
 *   4. Setup Card         — only when crop/location/size missing
 *   5. Farm Details Card  — Crop / Location / Size / Stage rows
 *   6. Action Buttons     — Edit Farm / Add New Farm / Switch Farm
 *                            (exactly three per spec §5).
 *   7. Help Card          — "Need help? Contact our team →" with
 *                            /support route + mailto fallback.
 *
 * Removed from this page (per spec §1 — "must NOT show tasks"):
 *   • Today's Action card (Home/Tasks own that surface)
 *   • Weather intelligence block
 *   • Task-related messaging — including the side-effect call to
 *     `getTodayTasks` + `processNotifications` (those still run on
 *     Home / FarmerTodayPage; running them HERE was unnecessary
 *     coupling between the farm-management surface and the daily
 *     task pipeline).
 *
 * Photo upload is local-only (no backend change required per the
 * spec's strict rule). Stored as a compressed data URL keyed per
 * farm id under `farroway:store:farmPhoto:<id>` so multiple farms
 * each carry their own picture.
 */

import { useMemo, useRef, useState } from 'react';
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
import VoiceLauncher from '../components/voice/VoiceLauncher.jsx';
import PhotoLauncher from '../components/photo/PhotoLauncher.jsx';
import {
  Sprout, Wheat, MapPin, Ruler, Calendar, HelpCircle, Plus, ArrowRight,
} from '../components/icons/lucide.jsx';
import { compressAvatar } from '../utils/avatarStorage.js';
import { loadData, saveData } from '../store/localStore.js';
import { getTodayTasks } from '../lib/dailyTasks/taskScheduler.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';
import HomeProgressBar from '../components/farmer/HomeProgressBar.jsx';

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

  // Spec §1 redesign: removed the previous useEffect that ran
  // `getTodayTasks` + `processNotifications`. Those side effects
  // belong on Home / FarmerTodayPage where the daily task surface
  // lives; firing them from My Farm coupled this management view
  // to the task pipeline for no rendered benefit. This page now
  // does pure presentation only.

  // Photo upload state (spec §3) — local-only persistence keyed
  // per farm id so each farm in a multi-farm household carries
  // its own picture. Stored as a compressed data URL via the
  // existing localStore (`farroway:store:*` namespace).
  const farmIdForPhoto = currentFarmId || profile?.id || null;
  const photoStoreKey = farmIdForPhoto ? `farmPhoto:${farmIdForPhoto}` : null;
  const initialPhoto = useMemo(() => {
    if (!photoStoreKey) return '';
    try { return loadData(photoStoreKey, '') || ''; }
    catch { return ''; }
  }, [photoStoreKey]);
  const [farmPhoto, setFarmPhoto] = useState(initialPhoto);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef(null);

  // ── Today's farm action + progress derivation ────────────────
  // Per the action-first spec, My Farm now shows a small
  // read-only "Today's farm action" link + a compact progress
  // bar. Both are derived from pure functions; we don't fire any
  // notification side effects here (the home loop owns that).
  const todaySnapshot = useMemo(() => {
    if (!profile) return { primaryTitle: '', done: 0, total: 0 };
    try {
      const plan = getTodayTasks({
        farm: {
          id: profile.id,
          crop: profile.crop,
          farmType: profile.farmType,
          cropStage: profile.cropStage,
          countryCode: profile.countryCode || profile.country,
        },
        weather: profile.weather || null,
      });
      const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
      const primary = tasks[0] || null;
      const total = tasks.length;
      const done = tasks.filter((tk) => tk && tk.completed === true).length;

      // Resolution order for the visible task title (matches the
      // localizeServerTask contract used by FarmerTodayPage):
      //   1. titleKey  → t(key)                   (preferred)
      //   2. raw title → getLocalizedTaskTitle    (phrase map)
      //   3. raw title → as-is                    (last resort)
      // Without step 2, engine-emitted titles like "Scout the
      // field for pests and damage" leaked English on FR/HA UIs.
      let primaryTitle = '';
      if (primary && primary.titleKey) {
        primaryTitle = t(primary.titleKey) || '';
      }
      if (!primaryTitle && primary && primary.title) {
        primaryTitle = (lang && lang !== 'en')
          ? (getLocalizedTaskTitle(primary.id, primary.title, lang) || primary.title)
          : primary.title;
      }
      if (!primaryTitle) {
        primaryTitle = tSafe('myFarm.todayAction.fallback', 'Check today\u2019s task');
      }
      return { primaryTitle, done, total };
    } catch {
      return { primaryTitle: '', done: 0, total: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile && profile.id, profile && profile.cropStage, lang]);

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

  // Safe-launch backyard-as-farm-type spec §1: derive whether the
  // active row is a backyard / home-garden record so the header,
  // buttons, and switch shortcut adapt without rewriting the data
  // model. Both legacy ('home_garden') and canonical ('backyard')
  // tags resolve to the garden surface.
  const _activeFarmType = String(farm?.farmType || '').toLowerCase();
  const isBackyardActive = _activeFarmType === 'backyard'
                        || _activeFarmType === 'home_garden'
                        || _activeFarmType === 'home';

  // Spec §5 — surface a "Switch to Farm" shortcut on the garden
  // surface when at least one non-backyard record exists, and
  // "Switch to Garden" on the farm surface when at least one
  // backyard record exists. The shortcut sits next to "Edit"
  // and complements the FarmSwitcher dropdown above.
  const hasOtherFarm = Array.isArray(farms)
    && farms.some((f) => {
      const t = String(f?.farmType || '').toLowerCase();
      const isBackyardRow = t === 'backyard' || t === 'home_garden' || t === 'home';
      return isBackyardActive ? !isBackyardRow : isBackyardRow;
    });

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

  // ── Photo upload (spec §3) ─────────────────────────────────
  // File picker → compressAvatar (existing helper, ~50 KB output)
  // → optimistic preview → persist via localStore. Never throws;
  // errors silently revert the busy flag so the UI stays usable.
  function handlePhotoPick(file) {
    if (!file || !photoStoreKey) return;
    setPhotoBusy(true);
    Promise.resolve()
      .then(() => compressAvatar(file))
      .then((dataUrl) => {
        if (typeof dataUrl === 'string' && dataUrl) {
          setFarmPhoto(dataUrl);
          try { saveData(photoStoreKey, dataUrl); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* never propagate */ })
      .finally(() => setPhotoBusy(false));
  }

  function handlePhotoInputChange(event) {
    const file = event?.target?.files?.[0];
    handlePhotoPick(file);
    // Reset the input so picking the same file again still fires.
    if (event?.target) event.target.value = '';
  }

  // Switch Farm CTA — scrolls back to the FarmSwitcher at the top
  // of this page so the user can pick a different farm without
  // leaving the management surface. Cleaner than a route change
  // because the FarmSwitcher is already mounted right there.
  function handleSwitchFarm() {
    try {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Best-effort: if the FarmSwitcher exposes an open trigger
      // via a custom event, kick it; otherwise the smooth scroll
      // alone is enough to expose the dropdown.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('farroway:openFarmSwitcher'));
      }
    } catch { /* never propagate */ }
  }

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
      <Header t={t} isBackyard={isBackyardActive} />

      {/* ── 2. Farm Selector (spec §2) ─────────────────────────
          Reuses the existing FarmSwitcher — single-farm farms
          render a static label (dropdown disabled but visible);
          multi-farm households open a popover with switch +
          add + manage. Recently restyled with a sprout leading
          icon + green accent border. */}
      <FarmSwitcher />

      {/* ── 3. Farm Identity Card (spec §3 redesign) ───────────
          Circular farm photo on the left + farm name + location
          on the right. "Upload photo" button below the picture
          opens the system file picker; the picked file is
          compressed to ~50 KB via the existing avatar helper and
          stored locally per farm id (no backend change). When no
          photo has been picked yet, we render initials over the
          green-tinted placeholder. */}
      <FarmIdentityCard
        farm={farm}
        photo={farmPhoto}
        busy={photoBusy}
        onPickClick={() => fileInputRef.current?.click()}
        farmName={farm.farmName || farm.name || tSafe('myFarm.unnamedFarm', 'My Farm')}
        location={
          farm.location || farm.locationLabel
          || localizeCountry(farm.country || farm.countryCode, lang)
          || ''
        }
        uploadLabel={tSafe('myFarm.uploadPhoto', 'Upload photo')}
        uploadingLabel={tSafe('myFarm.uploadingPhoto', 'Uploading…')}
      />
      {/* Hidden file input — clicked imperatively from the card. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoInputChange}
        style={S.hiddenFileInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* ── Today's farm action (action-first spec) ──────────
          Compact read-only card linking to /tasks. Stays subtle
          so it never competes with the Home primary CTA. The
          farmer's main task surface is still /tasks; this is
          just a contextual link from the farm-management view. */}
      {todaySnapshot.primaryTitle ? (
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          style={S.todayActionCard}
          data-testid="my-farm-today-action"
        >
          <span style={S.todayActionLabel}>
            {tSafe('myFarm.todayAction.title', "Today's farm action")}
          </span>
          <span style={S.todayActionTitle}>
            {todaySnapshot.primaryTitle}
          </span>
          <span style={S.todayActionChevron} aria-hidden="true">
            <ArrowRight size={14} />
          </span>
        </button>
      ) : null}

      {/* ── My progress (action-first spec) ─────────────────────
          Reuses the existing HomeProgressBar — same tones, same
          accessibility, same self-hide-when-empty rule. The bar
          self-hides when totalToday <= 0 so a clean day stays
          uncluttered. */}
      <div style={{ margin: '0 1rem' }}>
        <HomeProgressBar
          doneToday={todaySnapshot.done}
          totalToday={todaySnapshot.total}
        />
      </div>

      {/* ── 4. Setup Card (spec §4 redesign) ───────────────────
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

      {/* ── 6. Action Buttons (spec §5 redesign) ───────────────
          Safe-launch backyard-as-farm-type spec §5: labels +
          targets adapt to whether the active row is a backyard
          / home-garden record.

          Backyard:
            • Edit Garden          — primary green
            • Add Farm             — secondary (creates a non-
                                     backyard row, doesn't edit
                                     this garden)
            • Switch to Farm       — only when a non-backyard
                                     row already exists

          Farm:
            • Edit Farm            — primary green
            • Add Garden           — secondary (creates a backyard
                                     row, doesn't edit this farm)
            • Switch Farm          — scrolls to FarmSwitcher
      */}
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
          <span>
            {isBackyardActive
              ? tSafe('myFarm.editGarden', 'Edit Garden')
              : tSafe('myFarm.edit', 'Edit Farm')}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            // Backyard active → Add Farm should land on the
            // farm-setup flow (NewFarmScreen) directly, not the
            // adaptive setup which would default to backyard
            // again. Farm active → Add Garden routes to the
            // backyard onboarding flow.
            try {
              if (isBackyardActive) {
                navigate('/farm/new?intent=farm');
              } else {
                navigate('/onboarding/backyard');
              }
            } catch { /* swallow */ }
          }}
          style={S.actionBtnSecondary}
          data-testid={isBackyardActive ? 'my-farm-add-farm' : 'my-farm-add-garden'}
        >
          <span style={S.actionBtnIcon} aria-hidden="true">
            <Plus size={16} />
          </span>
          <span>
            {isBackyardActive
              ? tSafe('myFarm.addFarm', 'Add Farm')
              : tSafe('myFarm.addGarden', 'Add Garden')}
          </span>
        </button>
        <button
          type="button"
          onClick={handleSwitchFarm}
          style={S.actionBtnSecondary}
          data-testid="my-farm-switch"
          disabled={!hasOtherFarm && !(Array.isArray(farms) && farms.length > 1)}
        >
          <span style={S.actionBtnIcon} aria-hidden="true">
            <ArrowRight size={16} />
          </span>
          <span>
            {isBackyardActive
              ? tSafe('myFarm.switchToFarm', 'Switch to Farm')
              : (hasOtherFarm
                  ? tSafe('myFarm.switchToGarden', 'Switch to Garden')
                  : tSafe('myFarm.switchFarm', 'Switch Farm'))}
          </span>
        </button>
        {/* Garden-visibility spec §3 — explicit deep-link to the
            management surface that matches the user's active
            experience. The button title shifts so a backyard
            user reads "My Gardens" (not "Manage Farms") and
            never wonders where their garden went. The
            destination route is canonical (/manage-gardens vs
            /farms) so a deep-link from elsewhere keeps working. */}
        <button
          type="button"
          onClick={() => {
            try {
              navigate(isBackyardActive ? '/manage-gardens' : '/farms');
            } catch { /* swallow */ }
          }}
          style={S.actionBtnSecondary}
          data-testid="my-farm-manage"
        >
          <span style={S.actionBtnIcon} aria-hidden="true">
            <Sprout size={16} />
          </span>
          <span>
            {isBackyardActive
              ? tSafe('myFarm.viewGardens', 'My Gardens')
              : tSafe('myFarm.viewFarms',   'My Farms')}
          </span>
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

      {/* Voice assistant launcher (rollout §1) — floating FAB
          above the bottom-tab nav, hidden when
          FEATURE_VOICE_ASSISTANT is off. */}
      <VoiceLauncher variant="floating" />

      {/* Photo intelligence launcher — sits LEFT of the voice
          FAB so the two don't overlap. Hides itself when
          FEATURE_PHOTO_INTELLIGENCE is off. */}
      <PhotoLauncher
        variant="floating"
        farmId={farmIdForPhoto}
        cropId={profile?.crop || profile?.cropType || null}
      />
    </div>
  );
}

// ─── Local components ──────────────────────────────────────────

function Header({ t, isBackyard }) {
  // Safe-launch spec §2: title swaps "My Farm" → "My Garden" when
  // the active row is a backyard / home-garden record. Falls back
  // through tSafe so a missing translation never blanks the title.
  const title = isBackyard
    ? (tSafe('myGarden.title', 'My Garden')
       || t('myGarden.title') || 'My Garden')
    : (t('myFarm.title') || 'My Farm');
  return (
    <div style={S.header}>
      <span style={S.headerIcon} aria-hidden="true">
        <Sprout size={20} />
      </span>
      <h1 style={S.headerTitle}>{title}</h1>
    </div>
  );
}

/**
 * FarmIdentityCard — redesign §3.
 *
 * Composition:
 *   ┌──────────────────────────────────────────────┐
 *   │  ⬤ photo   │  Farm name                       │
 *   │            │  Location · small text           │
 *   │ [Upload   ]│                                  │
 *   │  photo    ]│                                  │
 *   └──────────────────────────────────────────────┘
 *
 * Photo:
 *   • 88px circular; data URL when set, otherwise initials over a
 *     green-tinted placeholder ring.
 *   • "Upload photo" button below the photo, centred under the
 *     circle. Disabled while compress is running.
 *
 * Behaviour:
 *   • Pure presentational — the file input lives on MyFarmPage
 *     so the click handler can keep the input ref tidy.
 */
function FarmIdentityCard({
  farm, photo, busy, onPickClick,
  farmName, location, uploadLabel, uploadingLabel,
}) {
  const initials = String(farmName || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '🌱';

  return (
    <section style={S.identityCard} data-testid="my-farm-identity">
      <div style={S.identityRow}>
        <div style={S.identityLeft}>
          <div style={S.photoWrap} aria-hidden="true">
            {photo ? (
              <img
                src={photo}
                alt=""
                style={S.photoImg}
                draggable={false}
              />
            ) : (
              <span style={S.photoFallback}>
                {initials}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onPickClick}
            disabled={busy}
            style={S.uploadBtn}
            data-testid="my-farm-upload-photo"
          >
            {busy ? uploadingLabel : uploadLabel}
          </button>
        </div>
        <div style={S.identityRight}>
          <div style={S.identityName}>{farmName}</div>
          {location ? (
            <div style={S.identityLocation}>{location}</div>
          ) : null}
          {/* Hide the placeholder location string when we have nothing
              meaningful — never render the literal "Add location" twice. */}
        </div>
      </div>
    </section>
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

  // ── Today's farm action card (action-first spec) ──────────
  // Subtle full-width chip linking to /tasks. Calmer than the
  // Home primary CTA so My Farm stays a management surface.
  todayActionCard: {
    width: 'calc(100% - 2rem)',
    margin: '0.75rem 1rem 0',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 14,
    padding: '0.7rem 1rem',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    textAlign: 'left',
  },
  todayActionLabel: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#86EFAC',
    flex: '0 0 auto',
  },
  todayActionTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  todayActionChevron: {
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
  },

  // ── Farm Identity Card (spec §3 redesign) ──────────────────
  identityCard: {
    margin: '0.75rem 1rem 0',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 16,
    padding: '1rem',
  },
  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  identityLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flex: '0 0 auto',
  },
  photoWrap: {
    width: 88,
    height: 88,
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.14)',
    border: '2px solid rgba(34,197,94,0.45)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoFallback: {
    fontSize: 28,
    fontWeight: 800,
    color: '#86EFAC',
    letterSpacing: '0.02em',
  },
  uploadBtn: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    borderRadius: 999,
    padding: '6px 14px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
    whiteSpace: 'nowrap',
  },
  identityRight: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  identityName: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#FFFFFF',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  identityLocation: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.65)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hiddenFileInput: {
    position: 'absolute',
    width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0,0,0,0)',
    border: 0,
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
