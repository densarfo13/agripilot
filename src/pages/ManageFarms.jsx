/**
 * ManageFarms — /farms control panel for multi-farm households.
 *
 *   <Route path="/farms" element={<ManageFarms />} />
 *
 * Spec contract (Manage Farms, Apr 2026)
 *   • Top: Active Farm card (name + crop + location + stage +
 *     Active badge + "View Farm" button → /my-farm).
 *   • Below: list of every farm as a simple card with Set
 *     Active / Edit / Archive actions.
 *   • Footer: "+ Add New Farm" → /farm/new.
 *   • Empty state: "Set up your first farm" with single CTA.
 *
 * Strict-rule audit
 *   • Pure consumer of useProfile — no new context, no new
 *     state plumbing. switchFarm + archiveFarm + farms list
 *     are all already exposed by ProfileContext / lib/api.
 *   • Active-farm persistence inherited from ProfileContext's
 *     existing localStorage layer — refreshing /farms keeps
 *     the same farm marked Active.
 *   • Archive is fire-and-forget POST to the existing v2
 *     endpoint (/api/v2/farm-profile/:farmId/archive). On
 *     success the page refreshes the farms list via the
 *     existing refreshFarms helper. Toast surfaces
 *     success / failure without crashing the page.
 *   • Mobile-first: stacked cards, large 44px buttons, no
 *     tables, no complex filters.
 */

import { useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { getCropLabelSafe } from '../utils/crops.js';
import { STAGE_KEYS } from '../utils/cropStages.js';
import { archiveFarm } from '../lib/api.js';
import AddFarmEmpty from '../components/farm/AddFarmEmpty.jsx';

function _formatSize(size, unit) {
  if (size == null || size === '') return null;
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit || 'acre').toString();
  return `${n} ${u}`;
}

function _farmName(f, t) {
  if (!f) return '';
  return f.farmName || f.name
      || tSafe('myFarm.unnamedFarm', 'Farm');
}

export default function ManageFarms() {
  const navigate = useNavigate();
  const {
    farms, currentFarmId, switchFarm, refreshFarms,
    loading: profileLoading,
  } = useProfile();
  const { t, lang } = useTranslation();

  const [toast, setToast] = useState('');
  const [archiving, setArchiving] = useState(null);
  const [setting, setSetting] = useState(null);

  // Visible list — exclude archived farms so the page reads as
  // "current farms"; archived ones can be re-surfaced from a
  // dedicated screen later if pilot data shows it's needed.
  const visibleFarms = useMemo(() => {
    if (!Array.isArray(farms)) return [];
    return farms.filter((f) => f && f.status !== 'archived');
  }, [farms]);

  const active = visibleFarms.find((f) => f.id === currentFarmId)
              || visibleFarms[0]
              || null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  async function handleSetActive(farmId) {
    if (!farmId || farmId === currentFarmId) return;
    setSetting(farmId);
    try {
      await Promise.resolve(switchFarm && switchFarm(farmId));
      showToast(tSafe('manageFarms.toast.setActive',
        'Active farm updated'));
    } catch {
      showToast(tSafe('manageFarms.toast.setFailed',
        'Could not switch farm. Try again.'));
    } finally {
      setSetting(null);
    }
  }

  function handleEdit(farmId) {
    if (!farmId) return;
    try { navigate(`/edit-farm?farmId=${encodeURIComponent(farmId)}`); }
    catch { /* never propagate from a render handler */ }
  }

  async function handleArchive(farm) {
    if (!farm || !farm.id) return;
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm(
          tSafe('manageFarms.archive.confirm',
            'Archive this farm? Your data is kept; you can restore it later.'),
        )
      : true;
    if (!confirmed) return;
    setArchiving(farm.id);
    try {
      await archiveFarm(farm.id);
      try { refreshFarms && refreshFarms(); } catch { /* ignore */ }
      showToast(tSafe('manageFarms.toast.archived',
        'Farm archived. Data is kept.'));
    } catch {
      showToast(tSafe('manageFarms.toast.archiveFailed',
        'Could not archive. Try again in a moment.'));
    } finally {
      setArchiving(null);
    }
  }

  // ── Loading skeleton — defensive ─────────────────────────
  if (profileLoading) {
    return (
      <main style={S.page} data-testid="manage-farms-loading">
        <div style={S.header}>
          <h1 style={S.title}>{tSafe('manageFarms.title', 'Manage Farms')}</h1>
        </div>
        <div style={S.skeleton}>
          <div style={S.skeletonRow} />
          <div style={S.skeletonRow} />
        </div>
      </main>
    );
  }

  // ── Empty state — single setup CTA ───────────────────────
  if (visibleFarms.length === 0) {
    return (
      <main style={S.page} data-testid="manage-farms-empty">
        <div style={S.header}>
          <h1 style={S.title}>{tSafe('manageFarms.title', 'Manage Farms')}</h1>
        </div>
        <AddFarmEmpty />
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="manage-farms-page">
      <div style={S.header}>
        <h1 style={S.title}>{tSafe('manageFarms.title', 'Manage Farms')}</h1>
      </div>

      {/* ─── 1. Active Farm Card ──────────────────────────── */}
      {active && (
        <section style={S.activeCard} data-testid="manage-farms-active">
          <div style={S.activeHeader}>
            <span style={S.activeBadge}>
              {tSafe('manageFarms.activeBadge', 'Active')}
            </span>
          </div>
          <h2 style={S.activeName}>{_farmName(active, t)}</h2>
          <ul style={S.activeMeta}>
            {active.crop && (
              <li style={S.activeMetaRow}>
                <span style={S.metaLabel}>{t('myFarm.crop')}</span>
                <span style={S.metaValue}>
                  {getCropLabelSafe(active.crop, lang)}
                </span>
              </li>
            )}
            {(active.location || active.locationLabel) && (
              <li style={S.activeMetaRow}>
                <span style={S.metaLabel}>{t('myFarm.location')}</span>
                <span style={S.metaValue}>
                  {active.location || active.locationLabel}
                </span>
              </li>
            )}
            {active.cropStage && (
              <li style={S.activeMetaRow}>
                <span style={S.metaLabel}>{t('myFarm.stage')}</span>
                <span style={S.metaValue}>
                  {t(STAGE_KEYS[active.cropStage])
                    || active.cropStage.replace(/_/g, ' ')}
                </span>
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => navigate('/my-farm')}
            style={S.viewBtn}
            data-testid="manage-farms-view-active"
          >
            {tSafe('manageFarms.viewFarm', 'View Farm')}
          </button>
        </section>
      )}

      {/* ─── 2. Farm List (excluding active) ─────────────── */}
      {visibleFarms.length > 1 && (
        <section style={S.listSection} data-testid="manage-farms-list">
          <h2 style={S.listTitle}>
            {tSafe('manageFarms.allFarms', 'All Farms')}
          </h2>
          <ul style={S.list}>
            {visibleFarms.map((f) => {
              const isActive = f.id === currentFarmId;
              const cropTxt = f.crop
                ? getCropLabelSafe(f.crop, lang) : null;
              const sizeTxt = _formatSize(f.size, f.sizeUnit);
              const locTxt = f.location || f.locationLabel || null;
              const stageTxt = f.cropStage
                ? (t(STAGE_KEYS[f.cropStage])
                   || f.cropStage.replace(/_/g, ' '))
                : null;
              return (
                <li key={f.id} style={S.farmCard} data-testid={`manage-farms-card-${f.id}`}>
                  <div style={S.farmCardHead}>
                    <h3 style={S.farmCardName}>{_farmName(f, t)}</h3>
                    {isActive && (
                      <span style={S.activeBadgeSmall}>
                        {tSafe('manageFarms.activeBadge', 'Active')}
                      </span>
                    )}
                  </div>
                  <ul style={S.farmCardMeta}>
                    {cropTxt && (
                      <li style={S.farmCardMetaRow}>
                        <span style={S.metaLabel}>{t('myFarm.crop')}</span>
                        <span style={S.metaValue}>{cropTxt}</span>
                      </li>
                    )}
                    {locTxt && (
                      <li style={S.farmCardMetaRow}>
                        <span style={S.metaLabel}>{t('myFarm.location')}</span>
                        <span style={S.metaValue}>{locTxt}</span>
                      </li>
                    )}
                    {sizeTxt && (
                      <li style={S.farmCardMetaRow}>
                        <span style={S.metaLabel}>{t('myFarm.size')}</span>
                        <span style={S.metaValue}>{sizeTxt}</span>
                      </li>
                    )}
                    {stageTxt && (
                      <li style={S.farmCardMetaRow}>
                        <span style={S.metaLabel}>{t('myFarm.stage')}</span>
                        <span style={S.metaValue}>{stageTxt}</span>
                      </li>
                    )}
                  </ul>
                  <div style={S.farmCardActions}>
                    <button
                      type="button"
                      onClick={() => handleSetActive(f.id)}
                      disabled={isActive || setting === f.id}
                      style={{
                        ...S.cardBtnPrimary,
                        ...(isActive ? S.cardBtnDisabled : {}),
                      }}
                      data-testid={`manage-farms-set-active-${f.id}`}
                    >
                      {isActive
                        ? tSafe('manageFarms.activeBadge', 'Active')
                        : (setting === f.id
                            ? tSafe('manageFarms.setting', 'Switching\u2026')
                            : tSafe('manageFarms.setActive', 'Set Active'))}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(f.id)}
                      style={S.cardBtn}
                      data-testid={`manage-farms-edit-${f.id}`}
                    >
                      {tSafe('myFarm.edit', 'Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(f)}
                      disabled={archiving === f.id}
                      style={S.cardBtnGhost}
                      data-testid={`manage-farms-archive-${f.id}`}
                    >
                      {archiving === f.id
                        ? tSafe('manageFarms.archiving', 'Archiving\u2026')
                        : tSafe('manageFarms.archive', 'Archive')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─── 3. Add Farm CTA ─────────────────────────────── */}
      <div style={S.addRow}>
        <button
          type="button"
          onClick={() => navigate('/farm/new')}
          style={S.addBtn}
          data-testid="manage-farms-add"
        >
          {tSafe('farmSwitcher.addNew', '+ Add new farm')}
        </button>
      </div>

      {/* Toast — calm, auto-dismisses. role="status" so screen
          readers announce without interrupting. */}
      {toast && (
        <div role="status" aria-live="polite" style={S.toast}>
          {toast}
        </div>
      )}
    </main>
  );
}

const C_NAVY        = '#0B1D34';
const C_NAVY_2      = '#081423';
const C_PANEL       = '#102C47';
const C_BORDER      = '#1F3B5C';
const C_GREEN       = '#22C55E';
const C_GREEN_FG    = '#86EFAC';
const C_TEXT        = '#FFFFFF';
const C_TEXT_DIM    = 'rgba(255,255,255,0.65)';

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C_NAVY} 0%, ${C_NAVY_2} 100%)`,
    color: C_TEXT,
    padding: '1rem 0 5rem',
  },
  header: {
    padding: '0.5rem 1rem 1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: C_TEXT,
    letterSpacing: '-0.01em',
  },

  // Active Farm card — prominent, green-tinted accent so the
  // current selection is unmistakable.
  activeCard: {
    margin: '0 1rem 1rem',
    background: 'rgba(34,197,94,0.06)',
    border: `1px solid rgba(34,197,94,0.40)`,
    borderRadius: 14,
    padding: '1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  activeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  activeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.20)',
    color: C_GREEN_FG,
    fontSize: '0.7rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: '1px solid rgba(34,197,94,0.55)',
  },
  activeName: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 800,
    color: C_TEXT,
  },
  activeMeta: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 4,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 8, marginTop: 4,
  },
  activeMetaRow: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    fontSize: '0.875rem', padding: '2px 0',
  },
  viewBtn: {
    appearance: 'none',
    border: 'none',
    background: C_GREEN,
    color: C_TEXT,
    borderRadius: 10,
    padding: '0.65rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
    marginTop: 4,
  },

  // List section
  listSection: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 1rem' },
  listTitle: {
    margin: '0 0 4px',
    fontSize: '0.8125rem',
    color: C_TEXT_DIM,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },

  // Per-farm card
  farmCard: {
    background: C_PANEL,
    border: `1px solid ${C_BORDER}`,
    borderRadius: 14,
    padding: '0.95rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  farmCardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  farmCardName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: C_TEXT,
  },
  activeBadgeSmall: {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.15)',
    color: C_GREEN_FG,
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: '1px solid rgba(34,197,94,0.45)',
  },
  farmCardMeta: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  farmCardMetaRow: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    fontSize: '0.8125rem', padding: '2px 0',
  },
  metaLabel: { color: C_TEXT_DIM, fontWeight: 600, flex: '0 0 auto' },
  metaValue: {
    color: C_TEXT, fontWeight: 600, textAlign: 'right',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  farmCardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  cardBtnPrimary: {
    flex: '1 1 auto',
    appearance: 'none',
    border: 'none',
    background: C_GREEN,
    color: C_TEXT,
    borderRadius: 10,
    padding: '0.55rem 0.9rem',
    fontSize: '0.825rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
  },
  cardBtnDisabled: {
    background: 'rgba(34,197,94,0.15)',
    color: C_GREEN_FG,
    border: '1px solid rgba(34,197,94,0.45)',
    cursor: 'default',
  },
  cardBtn: {
    flex: '1 1 auto',
    appearance: 'none',
    background: '#1A3B5D',
    border: `1px solid ${C_BORDER}`,
    color: C_TEXT,
    borderRadius: 10,
    padding: '0.55rem 0.9rem',
    fontSize: '0.825rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
  },
  cardBtnGhost: {
    flex: '1 1 auto',
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.78)',
    borderRadius: 10,
    padding: '0.55rem 0.9rem',
    fontSize: '0.825rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
  },

  // Add CTA
  addRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '1rem 1rem 0.5rem',
  },
  addBtn: {
    width: '100%',
    appearance: 'none',
    background: C_GREEN,
    color: C_TEXT,
    border: 'none',
    borderRadius: 12,
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
  },

  // Toast
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: '5rem',
    transform: 'translateX(-50%)',
    background: 'rgba(34,197,94,0.95)',
    color: C_TEXT,
    fontSize: '0.875rem',
    fontWeight: 700,
    padding: '0.55rem 1rem',
    borderRadius: 999,
    boxShadow: '0 10px 32px rgba(0,0,0,0.4)',
    zIndex: 60,
    pointerEvents: 'none',
  },

  // Skeleton (loading state)
  skeleton: { padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: 12 },
  skeletonRow: {
    height: 110,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C_BORDER}`,
  },
};
