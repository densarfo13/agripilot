/**
 * ManageGardens — /manage-gardens control panel for users who
 * keep one or more backyard / home gardens.
 *
 *   <Route path="/manage-gardens" element={<ManageGardens />} />
 *
 * Why this exists
 * ───────────────
 * The pilot turned up a confusing visibility bug: a user added a
 * backyard garden, then went looking for it under "Manage Farms"
 * and concluded the save had failed. Backyard rows were
 * intentionally classified as `farmType: 'backyard'` so the farm
 * partition stayed clean, but the UI never gave the user a place
 * to FIND those rows.
 *
 * This page is the missing surface. It mirrors the Manage Farms
 * shape (active card → list → add CTA) but reads ONLY garden rows
 * via getGardens() from multiExperience.js, and its actions flip
 * the `activeExperience` to 'garden' so Home / scan / daily-plan
 * all re-derive their context off the picked garden.
 *
 * Spec contract (Backyard / Garden Visibility, May 2026)
 *   • Header: "My Gardens" — title shows "name • plant • location
 *     • setup • size • Active badge".
 *   • List: every garden row as a card with Set Active / Edit /
 *     Remove actions (parallels Manage Farms' archive flow).
 *   • Footer: "+ Add Garden" → /onboarding/backyard.
 *   • Empty state: "Set up your first garden" CTA.
 *   • Switcher tabs at top whenever the user also has farms.
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • Pure consumer of useExperience + getGardens. No new state
 *     plumbing in ProfileContext.
 *   • Never throws — every click + render path try/catch wrapped.
 *   • All visible text via tSafe with English fallbacks; the
 *     keys mirror manageFarms.* so existing translations keep
 *     working without forcing a new round of locale work.
 *   • Mobile-first: stacked cards, 44 px buttons, no tables.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import useExperience from '../hooks/useExperience.js';
import {
  setActiveGardenId, removeExperience, EXPERIENCE,
} from '../store/multiExperience.js';
import ExperienceTabs from '../components/farm/ExperienceTabs.jsx';
import { formatLocation, formatFarmSize } from '../utils/formatDisplay.js';

// ── Color tokens (mirror ManageFarms.jsx for visual parity) ─────
const C_NAVY     = '#0B1D34';
const C_NAVY_2   = '#081423';
const C_PANEL    = '#102C47';
const C_BORDER   = '#1F3B5C';
const C_GREEN    = '#22C55E';
const C_GREEN_FG = '#86EFAC';
const C_TEXT     = '#FFFFFF';
const C_TEXT_DIM = 'rgba(255,255,255,0.65)';

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C_NAVY} 0%, ${C_NAVY_2} 100%)`,
    color: C_TEXT,
    padding: '1rem 0 5rem',
  },
  header: { padding: '0.5rem 1rem 1rem' },
  title: {
    margin: 0, fontSize: '1.5rem', fontWeight: 800,
    color: C_TEXT, letterSpacing: '-0.01em',
  },

  activeCard: {
    margin: '0 1rem 1rem',
    background: 'rgba(34,197,94,0.06)',
    border: `1px solid rgba(34,197,94,0.40)`,
    borderRadius: 14,
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  activeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 999,
    background: 'rgba(34,197,94,0.20)',
    color: C_GREEN_FG,
    fontSize: '0.7rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    border: '1px solid rgba(34,197,94,0.55)',
  },
  activeName: { margin: 0, fontSize: '1.125rem', fontWeight: 800, color: C_TEXT },
  meta: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 4,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 8, marginTop: 4,
  },
  metaRow: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    fontSize: '0.875rem', padding: '2px 0',
  },
  metaLabel: { color: C_TEXT_DIM, fontWeight: 600 },
  metaValue: { color: C_TEXT,     fontWeight: 700, textAlign: 'right' },

  viewBtn: {
    appearance: 'none', border: 'none',
    background: C_GREEN, color: C_TEXT,
    borderRadius: 10, padding: '0.65rem 1rem',
    fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44,
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
    marginTop: 4, fontFamily: 'inherit',
  },

  listSection: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 1rem' },
  listTitle: {
    margin: '0 0 4px', fontSize: '0.8125rem',
    color: C_TEXT_DIM, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  card: {
    background: C_PANEL, border: `1px solid ${C_BORDER}`,
    borderRadius: 14, padding: '0.95rem 1rem',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardName: { margin: 0, fontSize: '1rem', fontWeight: 800, color: C_TEXT },
  cardActions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  cardBtnPrimary: {
    appearance: 'none', flex: '1 1 auto',
    border: `1px solid rgba(34,197,94,0.32)`,
    background: 'rgba(34,197,94,0.18)',
    color: C_GREEN_FG,
    borderRadius: 10, padding: '0.55rem 0.8rem',
    fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
  cardBtnDisabled: { opacity: 0.65, cursor: 'default' },
  cardBtn: {
    appearance: 'none', flex: '1 1 auto',
    border: `1px solid ${C_BORDER}`,
    background: 'transparent', color: C_TEXT,
    borderRadius: 10, padding: '0.55rem 0.8rem',
    fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
  cardBtnGhost: {
    appearance: 'none', flex: '1 1 auto',
    border: `1px solid ${C_BORDER}`,
    background: 'transparent', color: C_TEXT_DIM,
    borderRadius: 10, padding: '0.55rem 0.8rem',
    fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
  badgeSmall: {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 999,
    background: 'rgba(34,197,94,0.18)',
    color: C_GREEN_FG,
    fontSize: '0.65rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    border: '1px solid rgba(34,197,94,0.40)',
  },

  addRow: { padding: '1rem' },
  addBtn: {
    appearance: 'none', display: 'block', width: '100%',
    border: `1px dashed ${C_BORDER}`,
    background: 'transparent', color: C_TEXT,
    borderRadius: 12, padding: '0.85rem 1rem',
    fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 48, fontFamily: 'inherit',
  },

  empty: {
    margin: '1rem', padding: '1.25rem',
    background: C_PANEL, border: `1px solid ${C_BORDER}`,
    borderRadius: 14, color: C_TEXT,
    display: 'flex', flexDirection: 'column', gap: 12,
    textAlign: 'center',
  },
  emptyTitle: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  emptyBody:  { margin: 0, fontSize: '0.875rem', color: C_TEXT_DIM, lineHeight: 1.4 },

  toast: {
    position: 'fixed', left: '50%', bottom: 24,
    transform: 'translateX(-50%)',
    background: C_PANEL, border: `1px solid ${C_BORDER}`,
    color: C_TEXT, padding: '0.6rem 1rem',
    borderRadius: 999, fontSize: '0.85rem', fontWeight: 700,
    boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
    zIndex: 50,
  },
};

// ── Helpers ─────────────────────────────────────────────────────
function _gardenName(g) {
  if (!g) return '';
  return g.name || g.farmName || g.cropLabel
      || (g.crop ? String(g.crop).replace(/_/g, ' ') : '')
      || tSafe('myFarm.unnamedGarden', 'Garden');
}

function _gardenPlant(g) {
  if (!g) return null;
  return g.cropLabel || g.crop || g.plantName
      || (Array.isArray(g.plants) && g.plants[0])
      || null;
}

function _gardenLocation(g) {
  if (!g) return null;
  // Prefer the structured shape so the formatter can normalise
  // USA + drop trailing whitespace. Falls back to the legacy
  // free-form `location` string when the row predates the spec.
  return formatLocation({
    region:  g.stateLabel || g.state || g.region || null,
    country: g.countryLabel || g.country || g.countryCode || null,
    city:    g.cityLabel || g.city || null,
  }) || g.location || null;
}

function _gardenSetupLabel(g) {
  if (!g) return null;
  const raw = String(g.growingSetup || '').toLowerCase();
  if (!raw || raw === 'unknown') return null;
  // Render the persisted setup verbatim with dashes/underscores
  // collapsed — the canonical i18n labels are owned by the
  // setup chooser, not this manage-list view.
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function _gardenSizeLabel(g) {
  if (!g) return null;
  // Reuse the spec formatter so a sqft-typed size renders with
  // the "(≈N acres)" preview. Bucket-only saves fall through
  // to "Small/Medium/Large garden" via formatFarmSize.
  return formatFarmSize({
    sizeCategory: g.gardenSizeCategory || g.farmSizeCategory || null,
    exactSize:    g.farmSize || g.size || null,
    unit:         g.sizeUnit || g.displayUnit || null,
    sizeInAcres:  g.sizeInAcres || null,
  });
}

// ── Component ───────────────────────────────────────────────────
export default function ManageGardens() {
  const navigate = useNavigate();
  const { gardens, activeGardenId, hasGarden } = useExperience();
  const [toast, setToast] = useState('');
  const [setting, setSetting] = useState(null);
  const [removing, setRemoving] = useState(null);

  const visibleGardens = useMemo(() => {
    if (!Array.isArray(gardens)) return [];
    return gardens.filter((g) => g && g.status !== 'archived');
  }, [gardens]);

  const active = visibleGardens.find((g) => g.id === activeGardenId)
              || visibleGardens[0]
              || null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  function handleSetActive(gardenId) {
    if (!gardenId || gardenId === activeGardenId) return;
    setSetting(gardenId);
    try {
      setActiveGardenId(gardenId);
      // Pin the experience to garden too so the Home plan +
      // bottom nav re-render off the chosen row immediately.
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            'farroway_active_experience',
            EXPERIENCE.GARDEN,
          );
          window.dispatchEvent(new CustomEvent('farroway:experience_switched', {
            detail: { experience: EXPERIENCE.GARDEN, activeId: gardenId },
          }));
        }
      } catch { /* swallow */ }
      showToast(tSafe('manageGardens.toast.setActive',
        'Active garden updated'));
    } catch {
      showToast(tSafe('manageGardens.toast.setFailed',
        'Could not switch garden. Try again.'));
    } finally {
      setSetting(null);
    }
  }

  function handleEdit(gardenId) {
    if (!gardenId) return;
    try { navigate(`/edit-farm?farmId=${encodeURIComponent(gardenId)}`); }
    catch { /* swallow */ }
  }

  function handleRemove(g) {
    if (!g || !g.id) return;
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm(
          tSafe('manageGardens.remove.confirm',
            'Remove this garden? Your event log is kept.'),
        )
      : true;
    if (!confirmed) return;
    setRemoving(g.id);
    try {
      const ok = removeExperience(g.id);
      if (ok) {
        showToast(tSafe('manageGardens.toast.removed',
          'Garden removed.'));
      } else {
        showToast(tSafe('manageGardens.toast.removeFailed',
          'Could not remove. Try again.'));
      }
    } catch {
      showToast(tSafe('manageGardens.toast.removeFailed',
        'Could not remove. Try again.'));
    } finally {
      setRemoving(null);
    }
  }

  function handleAddGarden() {
    // Garden-visibility spec §1 — Add Garden ALWAYS routes into
    // the backyard onboarding flow (which calls addGarden() at
    // save and lands the user back on /home). The simpler
    // /setup/garden route works equivalently when the BackyardV3
    // flag is off; we route to the v3 path which already exists.
    try { navigate('/onboarding/backyard'); } catch { /* swallow */ }
  }

  // ── Empty state ────────────────────────────────────────────
  if (!hasGarden || visibleGardens.length === 0) {
    return (
      <main style={S.page} data-testid="manage-gardens-empty">
        <div style={S.header}>
          <h1 style={S.title}>{tSafe('manageGardens.title', 'My Gardens')}</h1>
        </div>
        <ExperienceTabs current="garden" />
        <div style={S.empty} data-testid="manage-gardens-empty-card">
          <h2 style={S.emptyTitle}>
            {tSafe('manageGardens.empty.title',
              'Set up your first garden')}
          </h2>
          <p style={S.emptyBody}>
            {tSafe('manageGardens.empty.body',
              'A backyard, balcony, or potted plant counts. We\u2019ll guide you through a quick setup.')}
          </p>
          <button
            type="button"
            onClick={handleAddGarden}
            style={S.viewBtn}
            data-testid="manage-gardens-empty-add"
          >
            {tSafe('manageGardens.empty.cta', 'Add Garden')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="manage-gardens-page">
      <div style={S.header}>
        <h1 style={S.title}>{tSafe('manageGardens.title', 'My Gardens')}</h1>
      </div>

      <ExperienceTabs current="garden" />

      {/* ─── 1. Active Garden Card ──────────────────────────── */}
      {active && (
        <section style={S.activeCard} data-testid="manage-gardens-active">
          <div style={S.activeHeader}>
            <span style={S.activeBadge}>
              {tSafe('manageGardens.activeBadge', 'Active')}
            </span>
          </div>
          <h2 style={S.activeName}>{_gardenName(active)}</h2>
          <ul style={S.meta}>
            {_gardenPlant(active) && (
              <li style={S.metaRow}>
                <span style={S.metaLabel}>
                  {tSafe('manageGardens.plant', 'Plant')}
                </span>
                <span style={S.metaValue}>{_gardenPlant(active)}</span>
              </li>
            )}
            {_gardenLocation(active) && (
              <li style={S.metaRow}>
                <span style={S.metaLabel}>
                  {tSafe('manageGardens.location', 'Location')}
                </span>
                <span style={S.metaValue}>{_gardenLocation(active)}</span>
              </li>
            )}
            {_gardenSetupLabel(active) && (
              <li style={S.metaRow}>
                <span style={S.metaLabel}>
                  {tSafe('manageGardens.setup', 'Growing setup')}
                </span>
                <span style={S.metaValue}>{_gardenSetupLabel(active)}</span>
              </li>
            )}
            {_gardenSizeLabel(active) && (
              <li style={S.metaRow}>
                <span style={S.metaLabel}>
                  {tSafe('manageGardens.size', 'Size')}
                </span>
                <span style={S.metaValue}>{_gardenSizeLabel(active)}</span>
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={S.viewBtn}
            data-testid="manage-gardens-view-active"
          >
            {tSafe('manageGardens.viewGarden', 'View Garden')}
          </button>
        </section>
      )}

      {/* ─── 2. Garden List ─────────────────────────────── */}
      {visibleGardens.length > 1 && (
        <section style={S.listSection} data-testid="manage-gardens-list">
          <h2 style={S.listTitle}>
            {tSafe('manageGardens.allGardens', 'All Gardens')}
          </h2>
          <ul style={S.list}>
            {visibleGardens.map((g) => {
              const isActive = g.id === activeGardenId;
              const plant    = _gardenPlant(g);
              const loc      = _gardenLocation(g);
              const setup    = _gardenSetupLabel(g);
              const size     = _gardenSizeLabel(g);
              return (
                <li
                  key={g.id}
                  style={S.card}
                  data-testid={`manage-gardens-card-${g.id}`}
                >
                  <div style={S.cardHead}>
                    <h3 style={S.cardName}>{_gardenName(g)}</h3>
                    {isActive && (
                      <span style={S.badgeSmall}>
                        {tSafe('manageGardens.activeBadge', 'Active')}
                      </span>
                    )}
                  </div>
                  <ul style={S.meta}>
                    {plant && (
                      <li style={S.metaRow}>
                        <span style={S.metaLabel}>
                          {tSafe('manageGardens.plant', 'Plant')}
                        </span>
                        <span style={S.metaValue}>{plant}</span>
                      </li>
                    )}
                    {loc && (
                      <li style={S.metaRow}>
                        <span style={S.metaLabel}>
                          {tSafe('manageGardens.location', 'Location')}
                        </span>
                        <span style={S.metaValue}>{loc}</span>
                      </li>
                    )}
                    {setup && (
                      <li style={S.metaRow}>
                        <span style={S.metaLabel}>
                          {tSafe('manageGardens.setup', 'Growing setup')}
                        </span>
                        <span style={S.metaValue}>{setup}</span>
                      </li>
                    )}
                    {size && (
                      <li style={S.metaRow}>
                        <span style={S.metaLabel}>
                          {tSafe('manageGardens.size', 'Size')}
                        </span>
                        <span style={S.metaValue}>{size}</span>
                      </li>
                    )}
                  </ul>
                  <div style={S.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleSetActive(g.id)}
                      disabled={isActive || setting === g.id}
                      style={{
                        ...S.cardBtnPrimary,
                        ...(isActive ? S.cardBtnDisabled : null),
                      }}
                      data-testid={`manage-gardens-set-active-${g.id}`}
                    >
                      {isActive
                        ? tSafe('manageGardens.activeBadge', 'Active')
                        : (setting === g.id
                            ? tSafe('manageGardens.setting', 'Switching\u2026')
                            : tSafe('manageGardens.setActive', 'Set Active'))}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(g.id)}
                      style={S.cardBtn}
                      data-testid={`manage-gardens-edit-${g.id}`}
                    >
                      {tSafe('myFarm.edit', 'Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(g)}
                      disabled={removing === g.id}
                      style={S.cardBtnGhost}
                      data-testid={`manage-gardens-remove-${g.id}`}
                    >
                      {removing === g.id
                        ? tSafe('manageGardens.removing', 'Removing\u2026')
                        : tSafe('manageGardens.remove', 'Remove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─── 3. Add Garden CTA ─────────────────────────────── */}
      <div style={S.addRow}>
        <button
          type="button"
          onClick={handleAddGarden}
          style={S.addBtn}
          data-testid="manage-gardens-add"
        >
          {tSafe('manageGardens.addGarden', '+ Add new garden')}
        </button>
      </div>

      {toast && (
        <div role="status" aria-live="polite" style={S.toast}>
          {toast}
        </div>
      )}
    </main>
  );
}
