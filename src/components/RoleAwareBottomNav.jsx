/**
 * RoleAwareBottomNav — single bottom-nav component that adapts
 * its tabs to the signed-in user's role.
 *
 *   <RoleAwareBottomNav />
 *
 * Tabs come from `roleFeatures.getNavTabsForRole(user.role)`:
 *   farmer → Home / My Grow / Tasks / Progress / Scan
 *   ngo    → Dashboard / Farmers / Analytics
 *   buyer  → Marketplace / Listings / Contact
 *
 * Why this exists alongside the existing BottomTabNav
 *   The existing `farmer/BottomTabNav` is the canonical
 *   farmer surface. This component is its role-aware sibling
 *   for ngo + buyer surfaces — it reuses the same .bottom-nav
 *   class so the visual treatment is identical, only the
 *   tab labels + paths change.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • useAuthOrNull keeps it safe outside the AuthProvider.
 *   • Active tab matches by exact path or prefix.
 *   • Reuses the global .bottom-nav class from src/index.css
 *     so the role-accent token already tints the active tab.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthOrNull } from '../context/AuthContext.jsx';
import { getNavTabsForRole, getRoleFeatures } from '../lib/roleFeatures.js';

export default function RoleAwareBottomNav() {
  const auth = useAuthOrNull();
  const role = (auth && auth.user && auth.user.role) || 'farmer';
  const tabs = getNavTabsForRole(role);
  const features = getRoleFeatures(role);
  const location = useLocation();
  const navigate = useNavigate();

  // For farmers we DON'T render here — the existing
  // farmer/BottomTabNav is the canonical surface and is
  // already mounted by the farmer layout. This component is
  // primarily for ngo + buyer surfaces; it self-hides on
  // farmer to avoid double-stacked navs during the transition
  // from the legacy nav to this unified one.
  if (features === getRoleFeatures('farmer')) return null;

  const here = location && location.pathname || '';

  return (
    <nav
      className="bottom-nav"
      style={S.nav}
      data-testid="role-aware-bottom-nav"
      data-role={role}
    >
      {tabs.map((tab) => {
        const isActive = here === tab.path || here.startsWith(tab.path + '/');
        return (
          <button
            key={tab.key}
            type="button"
            className={isActive ? 'active' : ''}
            data-active={isActive ? 'true' : 'false'}
            data-testid={`nav-tab-${tab.key}`}
            onClick={() => {
              try { navigate(tab.path); } catch { /* swallow */ }
            }}
            style={{
              ...S.tab,
              color: isActive ? 'var(--role-accent)' : 'var(--text-muted)',
              fontWeight: isActive ? 800 : 600,
            }}
          >
            <span style={S.label}>{tab.label}</span>
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
    zIndex: 50,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 12px',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
  },
  tab: {
    flex: 1,
    minHeight: 56,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 4px',
    fontSize: 12,
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
