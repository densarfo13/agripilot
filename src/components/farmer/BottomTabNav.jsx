/**
 * BottomTabNav — persistent bottom navigation for farmer-facing screens.
 *
 * 4 tabs: Home, My Farm, Tasks, Progress
 * Icons always visible, label under icon, active tab highlighted with green indicator.
 * Large tap targets, mobile-first, premium dark styling.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { NAV_ICONS } from '../../lib/farmerIcons.js';

const TABS = [
  { key: 'home', path: '/dashboard', icon: NAV_ICONS.home, labelKey: 'nav.home' },
  { key: 'farm', path: '/my-farm', icon: NAV_ICONS.farm, labelKey: 'nav.myFarm' },
  { key: 'tasks', path: '/tasks', icon: NAV_ICONS.tasks, labelKey: 'nav.tasks' },
  { key: 'progress', path: '/progress', icon: NAV_ICONS.progress, labelKey: 'nav.progress' },
];

export default function BottomTabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  // Subscribe to farroway:langchange so the labels refresh on flip.
  // We don't use the bound `t` here — the cleanup spec mandates
  // tSafe for every nav label so a missing key shows the visible
  // tab key fallback rather than humanised English.
  useTranslation();

  const currentPath = location.pathname;

  return (
    <nav style={S.nav} data-testid="bottom-tab-nav">
      {TABS.map((tab) => {
        const isActive = currentPath === tab.path;
        // tSafe: missing key → visible tab key fallback (never an
        // English humanised value in non-English UIs).
        const label = tSafe(tab.labelKey, tab.key);
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(tab.path)}
            style={S.tab}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`tab-${tab.key}`}
          >
            {/* Active indicator bar */}
            {isActive && <span style={S.activeBar} />}
            <span style={{
              ...S.icon,
              ...(isActive ? S.iconActive : {}),
            }}>
              {tab.icon}
            </span>
            <span style={{
              ...S.label,
              ...(isActive ? S.labelActive : {}),
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const S = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    background: 'rgba(8,20,35,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 100,
    minHeight: '62px',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.2rem',
    padding: '0.5rem 0 0.375rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '58px',
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: '2.5px',
    borderRadius: '0 0 2px 2px',
    background: '#22C55E',
  },
  icon: {
    fontSize: '1.375rem',
    lineHeight: 1,
    opacity: 0.4,
    transition: 'opacity 0.2s ease, transform 0.15s ease',
  },
  iconActive: {
    opacity: 1,
    transform: 'scale(1.08)',
  },
  label: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#6F8299',
    letterSpacing: '0.02em',
    transition: 'color 0.2s ease',
  },
  labelActive: {
    color: '#22C55E',
    fontWeight: 700,
  },
};
