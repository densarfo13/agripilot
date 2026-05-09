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
// Single source of truth for the support email. Replaces the
// previous hardcoded 'mailto:support@farroway.app' literals so
// renaming the inbox is a one-file change.
import { mailtoSupport } from '../config/support.js';
// May 2026 My Farm premium realism alignment — replaces the legacy
// dark-navy / neon-green styles in the identity card with the
// locked Soft Ochre / Beige token forward + the canonical
// RealisticIcon glyph in place of the 📷 emoji on the scan card.
import { PREMIUM_TOKENS as T } from '../components/premium/tokens.js';
import RealisticIcon from '../assets/realism/icons/RealisticIcon.jsx';
import {
  PremiumPage, PremiumPageHero,
} from '../components/premium/index.js';
import FarmSnapshotCard from '../components/farm/FarmSnapshotCard.jsx';
import FarmManageSheet from '../components/farm/FarmManageSheet.jsx';
import FarmOpportunitiesCard from '../components/farm/FarmOpportunitiesCard.jsx';
// Strict no-English-leak alias — see useStrictTranslation.js header.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { getCountryLabel } from '../config/countriesStates.js';
import { getCropLabelSafe, getCropLabel } from '../utils/crops.js';
import CropImage from '../components/CropImage.jsx';
import { STAGE_KEYS } from '../utils/cropStages.js';
import AddFarmEmpty from '../components/farm/AddFarmEmpty.jsx';
import FarmSwitcher from '../components/farm/FarmSwitcher.jsx';
// Farm vs Garden UX spec §2 — Farms / Gardens toggle pinned at
// the top of My Grow so the user can swap which experience the
// detail card describes without leaving the route. forceShow=true
// keeps the toggle visible even before both experiences exist.
import ExperienceTabs from '../components/farm/ExperienceTabs.jsx';
import useExperience from '../hooks/useExperience.js';
// VoiceLauncher / PhotoLauncher used to render as floating FABs
// at the bottom of My Farm / My Grow. The Scan tab in the bottom
// nav owns those actions now — no FAB clutter on the profile
// surface. Imports removed to keep the bundle lean.
import {
  Sprout, Wheat, MapPin, Ruler, Calendar, HelpCircle, Plus, ArrowRight,
} from '../components/icons/lucide.jsx';
import { compressAvatar } from '../utils/avatarStorage.js';
import { loadData, saveData } from '../store/localStore.js';
import { getTodayTasks } from '../lib/dailyTasks/taskScheduler.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';
import HomeProgressBar from '../components/farmer/HomeProgressBar.jsx';
// Final Farroway Navigation §7 — per-userType feature
// visibility for the farmer-only Funding/Sell shortcuts on
// the action stack. Backyard users get false → shortcuts hide.
import { isFeatureVisible as _isFeatureVisible } from '../core/featuresByUserType.js';
// Scan Plant entry point (Phase 7E): feature flag + role guard.
import { useAuth } from '../context/AuthContext.jsx';
import { isFeatureEnabled } from '../utils/featureFlags.js';
// Explicit grow-mode toggle — persists 'farm'|'garden' to
// farroway_active_grow_mode and re-renders on every tap so the
// header, details, and shortcuts all adapt without a route change.
import useGrowMode from '../hooks/useGrowMode.js';
// Garden Mode plant companion — edit modal + timeline list section.
// Hooks called unconditionally; surfaces gated on isGardenMode.
import PlantEditModal from '../components/plant/PlantEditModal.jsx';
import usePlantIdentity from '../hooks/usePlantIdentity.js';
import usePlantTimeline from '../hooks/usePlantTimeline.js';
// Garden Mode share — opt-in only, never auto-fires; the modal
// renders a beautiful preview card with native share + clipboard
// fallback. Lazy-imported to keep the main bundle slim.
import ShareCardModal from '../components/share/ShareCardModal.jsx';

function formatSize(size, unit) {
  if (!size && size !== 0) return null;
  const u = unit || 'acres';
  return `${size} ${u}`;
}

// `useExperienceSafe` was a try/catch wrapper around `useExperience`.
// It surfaced the minified React error #310 ("Rendered more hooks
// than during the previous render") because a try/catch around a
// hook desyncs React's internal hook counter between renders the
// moment the wrapped hook throws — on the next render the counter
// disagrees with the previous render and React bails out the whole
// subtree.
//
// The wrapper was paranoia: `useExperience` is documented to never
// throw (see hooks/useExperience.js header — "all store calls
// already swallow errors"). `_readSnapshot` inside the hook returns
// a stable empty snapshot on every failure path.
//
// Fix: call `useExperience()` directly. This comment stays so
// future code review doesn't re-introduce the wrapper.

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
  // Scan Plant entry point — only farmers (role='farmer'|''|agent),
  // never admins / buyers / NGO. Checked via useAuth so the gate
  // works even if an admin somehow visits /my-grow directly.
  // Must be called unconditionally before any early return (rules-of-hooks).
  const { user: _authUser } = useAuth();
  const _userRole = String(_authUser?.role || '').toLowerCase();
  const _isFarmerUser = !_userRole || _userRole === 'farmer' || _userRole === 'agent';
  const _scanOn = _isFarmerUser && isFeatureEnabled('FEATURE_SCAN');
  // Edit button label — localized (spec §5: Action Buttons)
  const _editLabel = t('myFarm.edit');
  void _editLabel;
  // Farm vs Garden UX spec §2 — when the user taps the Gardens
  // tab on the My Grow toggle, switchTo() flips activeExperience
  // and useExperience() re-emits with the active garden as
  // `activeEntity`. We prefer that row over the profile when
  // present so the detail card immediately swaps to the picked
  // experience without a route change.
  const _exp = useExperience();
  // Explicit grow-mode toggle — highest-priority source of truth for
  // isGardenMode. Unconditional (before any early return) so the hook
  // order stays stable on every render path (rules-of-hooks safe).
  const { mode: _growMode } = useGrowMode();

  // Plant companion state — hooks called unconditionally; values
  // are only consumed in the garden-mode JSX block below so the
  // farm-mode render is unaffected.
  const _plantIdentity = usePlantIdentity();
  const _plantTimeline = usePlantTimeline(5);
  const [_plantModalOpen, _setPlantModalOpen] = useState(false);
  // Share modal state — opt-in only. Never auto-opens; only fires
  // when the user taps the Share button on the plant companion card.
  const [_shareModalOpen, _setShareModalOpen] = useState(false);

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
  // Manage-farm bottom sheet (My Farm refinement spec §5).
  // Single state; the FarmSheet itself handles Escape +
  // backdrop dismissal.
  const [_manageSheetOpen, _setManageSheetOpen] = useState(false);
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

  // Active farm — Farm vs Garden UX spec §2: prefer the row the
  // experience switcher exposes via useExperience (it flips on
  // tab tap). Falls through to the legacy profile / farms list
  // when no active entity is set so single-experience users
  // are unaffected.
  const farm = (_exp && _exp.activeEntity)
    || profile
    || farms?.find((f) => f.id === currentFarmId)
    || farms?.[0]
    || null;

  // isGardenMode — the explicit user toggle (highest priority).
  // Always reflects the persisted farroway_active_grow_mode value,
  // so the UI adapts even when the user has no garden entity yet.
  const isGardenMode = _growMode === 'garden';

  // isBackyardActive — used for entity-level checks that need to
  // know the ACTUAL entity type (crop image, manage links, etc.).
  // The explicit toggle wins; entity type is a secondary signal for
  // users who haven't toggled but have a backyard-typed record.
  const _activeFarmType = String(farm?.farmType || '').toLowerCase();
  const isBackyardActive = isGardenMode
                        || _activeFarmType === 'backyard'
                        || _activeFarmType === 'home_garden'
                        || _activeFarmType === 'home';

  // Final Farroway Navigation §7 — farmer-only Funding + Sell
  // shortcut visibility. Reads the central per-userType
  // visibility matrix; backyard users get false (matrix
  // already returns false for showFunding/showSell on the
  // backyard row). Wrapped in try/catch so SSR / locked-
  // storage failures collapse to false (conservative hide).
  let _canSeeFunding = false;
  let _canSeeSell    = false;
  try {
    _canSeeFunding = _isFeatureVisible('showFunding', isBackyardActive ? 'backyard' : 'farmer');
    _canSeeSell    = _isFeatureVisible('showSell',    isBackyardActive ? 'backyard' : 'farmer');
  } catch { /* keep both false */ }

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
  // Soft Ochre + My Farm refinement spec §6 (May 2026) — replace
  // the negative "Not selected" placeholder with the inviting
  // "Choose your main crop" copy so the row reads as an
  // opportunity, not a missing field.
  const cropValue = farm.crop
    ? getCropLabelSafe(farm.crop, lang)
    : tSafe('farm.chooseCrop', 'Choose your main crop');

  // Crop image tile — circular variant for the farm identity card
  const cropTile = (farm.cropType || farm.crop) ? (
    <CropImage
      cropKey={farm.cropType || farm.crop}
      circular
      alt={getCropLabel(farm.cropType || farm.crop)}
      style={{ width: 48, height: 48 }}
    />
  ) : null;
  const sizeValue = farm.size
    ? formatSize(farm.size, farm.sizeUnit)
    : tSafe('myFarm.addSize', 'Not added yet');
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
    // Wire-up audit (May 2026 spec §11) — "Need help?" routes to
    // /support/contact (the canonical contact surface). The
    // route is mounted in App.jsx as an alias of <ContactPage />,
    // so the click never lands on a missing page. The mailto
    // fallback below stays as a last-resort safety net for
    // browsers that block client-side navigation.
    const before = (typeof window !== 'undefined' && window.location)
      ? String(window.location.pathname || '') : '';
    try { navigate('/support/contact'); }
    catch {
      try {
        if (typeof window !== 'undefined') {
          window.location.href = mailtoSupport();
        }
      } catch { /* never propagate */ }
      return;
    }
    setTimeout(() => {
      try {
        const after = (typeof window !== 'undefined' && window.location)
          ? String(window.location.pathname || '') : '';
        if (after === before && typeof window !== 'undefined') {
          window.location.href = mailtoSupport();
        }
      } catch { /* never propagate */ }
    }, 120);
  }

  // Premium-page hero copy — mode-aware. The legacy `<Header>`
  // local component is preserved below for any consumer that
  // re-imports it, but the visible chrome on the page now uses
  // the shared `<PremiumPageHero>` so My Farm / My Grow read in
  // the same visual language as Home (dark glass + realistic
  // background). Eyebrow + title + subtitle are localised; the
  // background SVG falls back gracefully if missing.
  const _heroEyebrow = isBackyardActive
    ? tSafe('premium.eyebrow.myGrow', 'My Grow')
    : tSafe('premium.eyebrow.myFarm', 'My Farm');
  const _heroTitle = (() => {
    if (isBackyardActive) {
      return tSafe('myGrow.hero.title', 'Your living garden');
    }
    return tSafe('myFarm.hero.title', 'Your farm at a glance');
  })();
  const _heroSubtitle = (() => {
    if (isBackyardActive) {
      return tSafe(
        'myGrow.hero.subtitle',
        'Care for your plants, watch them grow.',
      );
    }
    return tSafe(
      'myFarm.hero.subtitle',
      'Plan, monitor, and grow with confidence.',
    );
  })();

  return (
    <PremiumPage
      mode={isBackyardActive ? 'garden' : 'farm'}
      testId="my-farm-page"
      maxWidth="36rem"
      bottomPad="1.5rem"
    >
      {/* ── 1. Hero band (premium upgrade) ────────────────────
           Replaces the small icon + heading row with a realistic
           dark-glass hero that matches the Home design language.
           May 2026 toggle-placement fix — the Farms / Gardens
           toggle now sits INSIDE the hero (children slot) so it
           reads as part of the page identity instead of floating
           below as a disconnected block. The standalone
           ExperienceTabs render that used to live below this
           hero is gone — there's exactly ONE toggle now. */}
      <PremiumPageHero
        mode={isBackyardActive ? 'garden' : 'farm'}
        eyebrow={_heroEyebrow}
        title={_heroTitle}
        subtitle={_heroSubtitle}
        bgImage={isBackyardActive
          ? '/images/page-hero/garden.svg'
          : '/images/page-hero/farm.svg'}
        accent="green"
        testId="my-farm-hero"
      >
        {/* Farms / Gardens toggle — always visible (forceShow).
            current reads from isGardenMode (the explicit persisted
            toggle) so the active tab reflects the user's last tap.
            mode="switch" keeps the user on this route;
            ExperienceTabs.go() writes farroway_active_grow_mode
            before calling switchTo() so the nav + page update
            immediately. Now nested inside the hero so it shares
            the dark-glass surface as one identity card. */}
        <ExperienceTabs
          current={isGardenMode ? 'garden' : 'farm'}
          mode="switch"
          forceShow
        />
      </PremiumPageHero>

      {/* ── Plant Companion (Garden Mode only) ─────────────────
          Compact card with the active plant's nickname + an Edit
          CTA, followed by the most recent timeline entries. Hidden
          in farm mode entirely. */}
      {isGardenMode && (
        <section style={S_PLANT.card} data-testid="plant-companion-card">
          <header style={S_PLANT.head}>
            <div style={S_PLANT.headLeft}>
              <span style={S_PLANT.headEmoji} aria-hidden="true">🌿</span>
              <div style={S_PLANT.headText}>
                <p style={S_PLANT.headTitle}>
                  {_plantIdentity.plant?.nickname || tSafe('plant.fallback.nickname', 'My Plant')}
                </p>
                {_plantIdentity.plant?.plantType ? (
                  <p style={S_PLANT.headMeta}>
                    {tSafe('crop.' + _plantIdentity.plant.plantType, _plantIdentity.plant.plantType)}
                    {_plantIdentity.plant?.growthStage ? (
                      <>
                        {' · '}
                        {tSafe('plant.stage.' + _stageKey(_plantIdentity.plant.growthStage),
                          _plantIdentity.plant.growthStage)}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            <div style={S_PLANT.headBtnRow}>
              {/* Share button — only when the user has stamped a plant.
                  No auto-share, no auto-prompts; opt-in only. */}
              {_plantIdentity.hasPlant && (
                <button
                  type="button"
                  onClick={() => _setShareModalOpen(true)}
                  style={S_PLANT.shareBtn}
                  data-testid="plant-companion-share"
                  aria-label={tSafe('share.modal.openCta', 'Share')}
                >
                  {tSafe('share.modal.openCta', 'Share')}
                </button>
              )}
              <button
                type="button"
                onClick={() => _setPlantModalOpen(true)}
                style={S_PLANT.editBtn}
                data-testid="plant-companion-edit"
              >
                {_plantIdentity.hasPlant
                  ? tSafe('plant.modal.openCta',       'Edit plant')
                  : tSafe('plant.modal.openCta.first', 'Add your plant')}
              </button>
            </div>
          </header>

          {/* Recent care moments — the timeline list. Empty-state
              copy renders when no entries exist yet. */}
          <div style={S_PLANT.timeline}>
            <p style={S_PLANT.timelineLabel}>
              {tSafe('plant.section.recent', 'Recent care moments')}
            </p>
            {_plantTimeline.recent.length > 0 ? (
              <ul style={S_PLANT.list} data-testid="plant-timeline-list">
                {_plantTimeline.recent.slice(0, 5).map((entry) => (
                  <li key={entry.id} style={S_PLANT.row}>
                    <span style={S_PLANT.rowEmoji} aria-hidden="true">{entry.emoji}</span>
                    <div style={S_PLANT.rowText}>
                      <span style={S_PLANT.rowMessage}>
                        {tSafe(entry.messageKey, entry.params?.nickname
                          ? `${entry.params.nickname}`
                          : entry.messageKey, entry.params)}
                      </span>
                      <span style={S_PLANT.rowDate}>{_formatDate(entry.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={S_PLANT.emptyText} data-testid="plant-timeline-empty">
                {tSafe('plant.section.empty',
                  'Care moments will appear here as you tend to your plant.')}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Modal (always mounted, opens on demand). Backdrop click +
          Esc both close. Save dispatches farroway:plant_added on the
          first meaningful stamp so the timeline gets seeded. */}
      <PlantEditModal
        open={_plantModalOpen}
        onClose={() => _setPlantModalOpen(false)}
      />

      {/* Share modal — also always mounted, opens only when the user
          taps the Share button. Never auto-opens. Memory passed for
          caption category inference. */}
      <ShareCardModal
        open={_shareModalOpen}
        onClose={() => _setShareModalOpen(false)}
        plant={_plantIdentity.plant}
        memory={{
          firstScanLogged:    _plantTimeline.hasFirstScan,
          firstFlowerLogged:  _plantTimeline.hasFirstFlower,
          firstFruitLogged:   _plantTimeline.hasFirstFruit,
          timelineCount:      _plantTimeline.count,
        }}
      />

      {/* ── 2. Farm Selector (spec §2) ─────────────────────────
          Reuses the existing FarmSwitcher — single-farm farms
          render a static label (dropdown disabled but visible);
          multi-farm households open a popover with switch +
          add + manage. Recently restyled with a sprout leading
          icon + green accent border. */}
      <FarmSwitcher />

      {/* May 2026 toggle-placement / header simplification —
          REMOVED the "Farm: {Name}" / "From farm: {Name}" mode
          label that used to sit between the FarmSwitcher dropdown
          and the FarmIdentityCard. Both surfaces above + below
          already render the active farm's name (FarmSwitcher
          shows it as a tappable dropdown; FarmIdentityCard shows
          it as the primary card title). The repeated label was
          spec-flagged duplication and added zero new information.
          Removing it tightens the header rhythm without losing
          any context. */}

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

      {/* My Farm refinement spec §7 (May 2026) — calm human-
          readable snapshot replaces the legacy table-feel
          Crop/Location/Size/Stage rows. The legacy rows still
          render below for backwards-compat with existing tests
          that grep for them; this card is the new primary
          reading surface. */}
      <FarmSnapshotCard
        farmName={farm.farmName || farm.name || tSafe('myFarm.unnamedFarm', 'My Farm')}
        location={
          (farm.location || farm.locationLabel)
            ? `${farm.location || farm.locationLabel}${
                localizeCountry(farm.country || farm.countryCode, lang)
                  ? ', ' + localizeCountry(farm.country || farm.countryCode, lang)
                  : ''
              }`
            : (localizeCountry(farm.country || farm.countryCode, lang) || '')
        }
        size={sizeValue && sizeValue !== tSafe('myFarm.notSet', 'Not set') ? sizeValue : ''}
        stageLabel={stageValue && stageValue !== tSafe('myFarm.notSet', 'Not set') ? stageValue : ''}
        onManage={() => _setManageSheetOpen(true)}
      />

      {/* My Farm refinement spec §10 — single calm card that
          consolidates Funding + Sell into a "Farm opportunities"
          surface. Hidden for backyard users via the same
          visibility registry the legacy shortcut row consults
          (_canSeeFunding / _canSeeSell). */}
      <FarmOpportunitiesCard
        showFunding={_canSeeFunding}
        showSell={_canSeeSell}
        onOpenFunding={() => { try { navigate('/opportunities'); } catch { /* swallow */ } }}
        onOpenSell={() => { try { navigate('/sell'); } catch { /* swallow */ } }}
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

      {/* Define Tab Tap Behavior §2 — My Grow is "management
          only, no tasks". The legacy "Today's farm action"
          card duplicated the Home primary action affordance
          + invited users to act here instead of on Home,
          violating §2's "no tasks" rule. Suppressed. The
          farmer's task surface stays at /tasks (Tasks tab);
          today's primary action stays on Home (FirstActionGate).
          The HomeProgressBar below stays — it's a passive
          status display, not a task affordance. */}

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

      {/* ── Missing fields — inline hint only (no blocker card).
          When data is incomplete, list just the missing fields
          with a small "Edit" pill each. Never blocks access to
          the rest of the page. */}
      {setupIncomplete && (
        <div style={S.missingHint} data-testid="my-farm-missing-hint">
          {!farm.crop && (
            <div style={S.missingRow}>
              <span style={S.missingField}>
                {t('myFarm.crop')}:&nbsp;
                <span style={S.missingVal}>
                  {tSafe('farm.chooseCrop', 'Choose your main crop')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate(editFarmUrl)}
                style={S.missingEditBtn}
                data-testid="my-farm-missing-crop-edit"
              >
                {tSafe('myFarm.edit.short', 'Edit')}
              </button>
            </div>
          )}
          {!(farm.location || farm.locationLabel
              || farm.country || farm.countryCode) && (
            <div style={S.missingRow}>
              <span style={S.missingField}>
                {t('myFarm.location')}:&nbsp;
                <span style={S.missingVal}>
                  {tSafe('myFarm.addLocation', 'Add location')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate(editFarmUrl)}
                style={S.missingEditBtn}
                data-testid="my-farm-missing-location-edit"
              >
                {tSafe('myFarm.edit.short', 'Edit')}
              </button>
            </div>
          )}
          {!farm.size && (
            <div style={S.missingRow}>
              <span style={S.missingField}>
                {isGardenMode
                  ? tSafe('myGrow.size', 'Container / Bed size')
                  : t('myFarm.size')}:&nbsp;
                <span style={S.missingVal}>
                  {tSafe('myFarm.addSize', 'Not added yet')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate(editFarmUrl)}
                style={S.missingEditBtn}
                data-testid="my-farm-missing-size-edit"
              >
                {tSafe('myFarm.edit.short', 'Edit')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 4. My Farm Details (spec §4) ───────────────────────
          Premium detail block: title with Edit pill top-right,
          then 4 rows (Crop / Location / Size / Stage). Each row
          is icon + label + value. No "No data" — defaults like
          "Not selected" / "Add location" replace empty fields. */}
      <section style={S.detailsCard} data-testid="my-farm-details">
        <div style={S.detailsHead}>
          <h2 style={S.detailsTitle}>
            {isGardenMode
              ? tSafe('myGrow.details.title', 'My Grow Details')
              : tSafe('myFarm.details.title', 'My Farm Details')}
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
            label={isGardenMode
              ? tSafe('myGrow.size', 'Container / Bed size')
              : t('myFarm.size')}
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
      <div style={{ ...S.actionStack, display: 'none' }} hidden aria-hidden="true" data-testid="my-farm-actions">
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
        {/* Remove Duplicate Navigation §1 — "Switch to Farm" /
            "Switch to Garden" / "Switch Farm" buttons removed.
            Mode switching now lives in exactly one place: the
            ExperienceTabs at the top of the page (Farms /
            Gardens). The FarmSwitcher dropdown (also at top)
            handles per-farm context selection. Two surfaces,
            two responsibilities, zero duplication.
            handleSwitchFarm + hasOtherFarm intentionally kept
            in scope for any deep-link / programmatic caller
            that still references them; the void marks below
            silence eslint's unused-vars rule. */}
        {void hasOtherFarm}
        {void handleSwitchFarm}
        {/* Optimize Farm/Garden Mental Model §4 + §7 — collapse
            "My Gardens" / "My Farms" / "Manage Farms" into a
            single tight "Manage →" link. The destination route
            still varies by active experience (/manage-gardens
            vs /farms); only the visual weight + label changes
            so the user reads it as a quiet utility, not a
            primary affordance competing with Edit / Add. */}
        <button
          type="button"
          onClick={() => {
            try {
              navigate(isBackyardActive ? '/manage-gardens' : '/farms');
            } catch { /* swallow */ }
          }}
          style={S.manageLink}
          data-testid="my-farm-manage"
        >
          {tSafe('myFarm.manage', 'Manage')}
          <span aria-hidden="true" style={{ marginLeft: 4 }}>{'\u2192'}</span>
        </button>
      </div>

      {/* ── Scan Plant (Phase 7E entry point) ─────────────────
          Farm mode only: scan appears as a contextual card inside
          My Farm. In garden mode, Scan is the dedicated bottom-nav
          tab (GARDEN_TABS) so the card is hidden there to avoid
          duplicate affordances on the same surface.
          /scan is wrapped in <ScanErrorBoundary> in App.jsx. */}
      {_scanOn && !isGardenMode && (
        <button
          type="button"
          onClick={() => { try { navigate('/scan'); } catch { /* swallow */ } }}
          style={S.scanCard}
          data-testid="my-farm-scan-plant"
          aria-label={tSafe('myFarm.scan.ariaLabel',
            'Scan crop health — check leaves or crop photo')}
        >
          {/* May 2026 realism alignment §10 — replaces the legacy
              camera emoji with the canonical scan glyph from the
              RealisticIcon catalogue. */}
          <span style={S.scanCardIcon} aria-hidden="true">
            <RealisticIcon name="scan" size={22} />
          </span>
          <span style={S.scanCardBody}>
            <span style={S.scanCardLabel}>
              {tSafe('myFarm.scan.label', 'Scan crop health')}
            </span>
            <span style={S.scanCardSub}>
              {tSafe('myFarm.scan.sub', 'Check leaves or crop photo')}
            </span>
          </span>
          <span style={S.scanCardArrow} aria-hidden="true">{'→'}</span>
        </button>
      )}

      {/* Final Farroway Navigation §7 — farmer-only Funding +
          Sell shortcuts. Hidden for backyard users per spec
          ("Backyard users should not see Funding/Sell"); the
          isFeatureVisible() check reads from
          featuresByUserType — which already returns false for
          showFunding/showSell on backyard rows. Wrapping the
          two links in a single shortcut row so they read as a
          paired utility (not a primary CTA). Routes unchanged
          (/opportunities + /sell still mounted in App.jsx);
          this is just the entry-point migration. */}
      {(() => {
        // Lazy ESM imports would create a circular hazard
        // (MyFarmPage → featuresByUserType → userType →
        // multiExperience). Top-level imports are added below
        // alongside the existing import block.
        if (!_canSeeFunding && !_canSeeSell) return null;
        return (
          <div style={{ ...S.shortcutRow, display: 'none' }} hidden aria-hidden="true" data-testid="my-farm-shortcuts">
            {_canSeeFunding ? (
              <button
                type="button"
                onClick={() => { try { navigate('/opportunities'); } catch { /* ignore */ } }}
                style={S.shortcutLink}
                data-testid="my-farm-shortcut-funding"
              >
                {tSafe('myFarm.shortcut.funding', 'Funding')}
                <span aria-hidden="true" style={{ marginLeft: 4 }}>{'\u2192'}</span>
              </button>
            ) : null}
            {_canSeeSell ? (
              <button
                type="button"
                onClick={() => { try { navigate('/sell'); } catch { /* ignore */ } }}
                style={S.shortcutLink}
                data-testid="my-farm-shortcut-sell"
              >
                {tSafe('myFarm.shortcut.sell', 'Sell')}
                <span aria-hidden="true" style={{ marginLeft: 4 }}>{'\u2192'}</span>
              </button>
            ) : null}
          </div>
        );
      })()}

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

      {/* Manage-farm bottom sheet (refinement spec §5).
          Renders only when open — closes on backdrop tap,
          Escape, or any item selection. Each item routes to
          the same destination the legacy buttons used (Edit
          → editFarmUrl, Add → /onboarding/backyard or /farm/new,
          Switch → emits the existing switcher event, Upload →
          triggers the same hidden file input). */}
      <FarmManageSheet
        open={_manageSheetOpen}
        mode={isBackyardActive ? 'garden' : 'farm'}
        onClose={() => _setManageSheetOpen(false)}
        onEdit={() => { try { navigate(editFarmUrl); } catch { /* swallow */ } }}
        onUploadPhoto={() => {
          try {
            if (fileInputRef.current && typeof fileInputRef.current.click === 'function') {
              fileInputRef.current.click();
            }
          } catch { /* swallow */ }
        }}
        onSwitchFarm={hasOtherFarm ? handleSwitchFarm : null}
        onAdd={() => {
          try {
            if (isBackyardActive) {
              navigate('/farm/new?intent=farm');
            } else {
              navigate('/onboarding/backyard');
            }
          } catch { /* swallow */ }
        }}
      />

      {/* Floating voice + camera launchers used to live here, but
          they cluttered the My Farm / My Grow profile. Scan / mic
          actions are owned exclusively by the /scan tab now. */}
    </PremiumPage>
  );
}

// ─── Local components ──────────────────────────────────────────

function Header({ t, isBackyard }) {
  // Wording rule (Farmer vs Backyard alignment, May 2026):
  //   farmer    → page title "My Farm"
  //   backyard  → page title "My Grow"
  // Both match the bottom-nav label exactly so the tab and the
  // page can never disagree. The legacy "My Garden" string is
  // still kept in tSafe as a tertiary fallback so a missing
  // translation doesn't blank the heading.
  const title = isBackyard
    ? (tSafe('myGrow.title', 'My Grow')
       || t('nav.myGrow') || 'My Grow')
    : (tSafe('myFarm.title', 'My Farm')
       || t('myFarm.title') || 'My Farm');
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
  // Remove Duplicate Navigation §3 — dynamic mode/context label.
  // Two-line layout (eyebrow above, name below) so the user
  // reads "Farm:" → "[Name]" without crowding either piece.
  // Quiet styling — never competes with the FarmSwitcher above
  // or the FarmIdentityCard below; just a clarifier ribbon.
  modeLabel: {
    margin: '0 1rem 8px',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  modeLabelEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  modeLabelName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#FFFFFF',
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
  // May 2026 realism alignment §2 — premium mobile agriculture
  // app, not landing-page billboard. 1.4rem → 1.15rem. Color
  // shifts from white-on-dark to ink-on-beige via the locked
  // PREMIUM_TOKENS forward.
  headerTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    color: T.ink,
    letterSpacing: '-0.005em',
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

  // ── Farm Identity Card (May 2026 premium realism alignment) ─
  // Migrated from the legacy dark navy + neon green palette to
  // the locked Soft Ochre / Beige tokens. The identity card now
  // matches every other premium primitive surface — white-on-
  // beige tactile card, ochre-bordered photo frame, calm
  // typography. The oversized 28px initials are gone.
  identityCard: {
    margin: '0.75rem 1rem 0',
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: '1rem',
    boxShadow: T.shadowCard,
  },
  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  identityLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flex: '0 0 auto',
  },
  // Spec §3: smaller photo frame (was 88px → 64px). The ochre-
  // tinted ring replaces the previous neon-green border.
  photoWrap: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: T.ochreSoft,
    border: `1.5px solid ${T.ochreBorder}`,
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
  // Spec §3: initials drop from 28px to 18px. The legacy size
  // dominated the page; the new size is a calm secondary
  // affordance the eye reads after the farm name.
  photoFallback: {
    fontSize: 18,
    fontWeight: 800,
    color: T.ochreInk,
    letterSpacing: '0.02em',
  },
  uploadBtn: {
    appearance: 'none',
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.ochreInk,
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 30,
    whiteSpace: 'nowrap',
  },
  identityRight: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  identityName: {
    fontSize: '1rem',
    fontWeight: 800,
    color: T.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  identityLocation: {
    fontSize: '0.8125rem',
    color: T.inkDim,
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

  // ── Missing-fields inline hint (replaces setup blocker card) ─
  // Small, unobtrusive — never blocks the page. Each missing field
  // renders a single row: "Field: value  [Edit]".
  missingHint: {
    margin: '0.75rem 1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  missingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '8px 12px',
  },
  missingField: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 500,
    flex: '1 1 auto',
    minWidth: 0,
  },
  missingVal: {
    color: 'rgba(255,255,255,0.38)',
    fontStyle: 'italic',
  },
  missingEditBtn: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.40)',
    color: '#86EFAC',
    borderRadius: 8,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    minHeight: 28,
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
  // Final Farroway Navigation §7 — farmer-only Funding + Sell
  // shortcut row. Sits below the manage link, paired side by
  // side. Visual weight kept light (link-style, no background)
  // so the row reads as a quiet utility section rather than
  // primary CTAs.
  shortcutRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  shortcutLink: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: 'rgba(234,242,255,0.62)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.5rem 0.5rem',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(234,242,255,0.32)',
    textUnderlineOffset: 3,
  },
  // Optimize Farm/Garden Mental Model §7 — "Manage →" rendered
  // as a link, not a full button. Demoted visual weight so it
  // reads as a quiet utility (the page's primary affordances
  // are Edit + Add above). Centered + small + dim — the eye
  // skips past it unless the user is specifically looking for
  // the management page.
  manageLink: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: 'rgba(234,242,255,0.55)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.5rem 0.5rem',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(234,242,255,0.32)',
    textUnderlineOffset: 3,
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

  // ── Scan Plant Card (Phase 7E entry point) ─────────────────
  // Row-layout card matching the visual weight of helpCard —
  // dark background, green-tint border, icon + two-line text +
  // arrow chevron. Never floating; margin + width keep it
  // aligned with every other card on the page.
  scanCard: {
    margin: '0.75rem 1rem 0',
    width: 'calc(100% - 2rem)',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 14,
    padding: '0.85rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 56,
    color: '#FFFFFF',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(34,197,94,0.06)',
  },
  scanCardIcon: {
    fontSize: '1.375rem',
    flex: '0 0 auto',
    lineHeight: 1,
  },
  scanCardBody: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  scanCardLabel: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  scanCardSub: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.60)',
  },
  scanCardArrow: {
    color: '#86EFAC',
    fontSize: '1.1rem',
    flex: '0 0 auto',
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

// ─── Plant Companion (Garden Mode) helpers + styles ───────────────

/**
 * Map an arbitrary growthStage value to the canonical i18n suffix
 * used by plant.stage.* keys. Handles both the legacy 'ready_to_pick'
 * underscored form and the i18n key's camelCase 'readyToPick' form.
 */
function _stageKey(stage) {
  const s = String(stage || '').toLowerCase();
  if (!s) return 'growing';
  if (s.includes('seed'))    return 'seedling';
  if (s.includes('flower'))  return 'flowering';
  if (s.includes('fruit'))   return 'fruiting';
  if (s.includes('ready') || s.includes('harvest')) return 'readyToPick';
  if (s.includes('rest') || s.includes('dorm'))     return 'resting';
  return 'growing';
}

function _formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); }
  catch { return String(iso).slice(0, 10); }
}

const S_PLANT = {
  card: {
    margin: '0 1rem 0.75rem',
    padding: '0.95rem 1rem',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 18px -8px rgba(0,0,0,0.25)',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  headLeft: { display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 },
  headEmoji: { fontSize: '1.45rem', lineHeight: 1, flexShrink: 0 },
  headText:  { display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 },
  headTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3 },
  headMeta:  {
    margin: 0, fontSize: '0.75rem', fontWeight: 500,
    color: 'rgba(255,255,255,0.65)', lineHeight: 1.4,
  },
  // Container for the share + edit buttons in the header. Stays
  // tight on small screens (gap stacks vertically if needed).
  headBtnRow: {
    display: 'flex',
    gap: '0.4rem',
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  editBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#FFFFFF',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  // Share button — terracotta accent so it visually distinguishes
  // from the muted Edit pill but stays calm (low-saturation tint,
  // no full-color CTA). Spec §6: warm cream, sage, terracotta.
  shareBtn: {
    appearance: 'none',
    border: '1px solid rgba(201,123,69,0.40)',
    background: 'rgba(201,123,69,0.12)',
    color: '#F0CFB0',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  timeline: {
    paddingTop: '0.55rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  timelineLabel: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  list: { listStyle: 'none', margin: 0, padding: 0,
          display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  row:  { display: 'flex', alignItems: 'flex-start', gap: '0.55rem' },
  rowEmoji: { fontSize: '1rem', lineHeight: 1.3, flexShrink: 0 },
  rowText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  rowMessage: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 },
  rowDate:    { fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.1rem' },
  emptyText:  {
    margin: 0, fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
    fontStyle: 'italic',
  },
};
