/**
 * PageActions.jsx — canonical NotificationBell + Menu action cluster
 * rendered inside each page's hero/header (not in a separate chrome
 * strip above the content).
 *
 *   import PageActions from '../../components/layout/PageActions.jsx';
 *   <header style={pageHeaderStyles}>
 *     <h1>My Farm</h1>
 *     <PageActions />
 *   </header>
 *
 * Carries:
 *   • <NotificationBell aria-label="Notifications" /> with unread badge
 *   • a Menu button (☰) with aria-label="Menu" that navigates to
 *     /settings — same destination as the prior layout chrome menu.
 *
 * Mobile-first sizing (38×38), iOS Safari tap-highlight cleared,
 * flexShrink:0 so the cluster never wraps onto a second line.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import NotificationBell from '../NotificationBell.jsx';
import LanguageBottomSheet from '../i18n/LanguageBottomSheet.jsx';
import { tSafe } from '../../i18n/tSafe.js';

export default function PageActions({
  testId = 'page-actions',
  // Optional override for the menu destination. Default `/settings`
  // matches the prior layout chrome menu destination, so navigation
  // behavior is unchanged across the migration.
  menuTo = '/settings',
  // Optional override for the bell's accessible label.
  bellAriaLabel = 'Notifications',
  // Optional override for the menu's accessible label.
  menuAriaLabel = 'Menu',
  // Optional override for the language button's accessible label.
  languageAriaLabel = 'Change language',
  // Style override so dark heroes can pass a translucent variant.
  variant = 'light',
}) {
  const isDark = variant === 'dark';
  const buttonStyle = isDark ? S.menuBtnDark : S.menuBtn;
  // Sprint #183 — language sheet state, owned at the cluster level
  // so the 🌐 button can open it from any page header.
  const [langOpen, setLangOpen] = useState(false);
  return (
    <div style={S.cluster} data-testid={testId}>
      <NotificationBell
        ariaLabel={tSafe('header.actions.notifications', bellAriaLabel)}
        testId={`${testId}-bell`}
      />
      <button
        type="button"
        onClick={() => setLangOpen(true)}
        aria-label={tSafe('header.actions.language', languageAriaLabel)}
        style={buttonStyle}
        data-testid={`${testId}-language`}
      >
        <span aria-hidden="true">🌐</span>
      </button>
      <Link
        to={menuTo}
        aria-label={tSafe('header.actions.menu', menuAriaLabel)}
        style={buttonStyle}
        data-testid={`${testId}-menu`}
      >
        <span aria-hidden="true">☰</span>
      </Link>
      <LanguageBottomSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
      />
    </div>
  );
}

const S = {
  cluster: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexShrink: 0,
  },
  menuBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(110,139,97,0.10)',
    border: '1px solid rgba(110,139,97,0.30)',
    color: '#33503A',
    fontSize: '1.05rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  menuBtnDark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#FFFFFF',
    fontSize: '1.05rem',
    fontWeight: 700,
    textDecoration: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};
