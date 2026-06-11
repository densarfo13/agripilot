/**
 * LanguageBottomSheet.jsx — globally-accessible language picker.
 *
 * Sprint #183. Opens from the 🌐 button in PageActions (next to bell
 * + menu). Mobile-first bottom-sheet shape that slides up from the
 * bottom on phones and centers as a small modal on desktop.
 *
 * Contract:
 *   <LanguageBottomSheet
 *     open={isOpen}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * What's shown:
 *   - Search field (filters by code, English name, or native name)
 *   - "Recently used" row (last 3 picked, persisted in localStorage)
 *   - Full list of 6 launch languages
 *
 * Persistence:
 *   - Selection writes to AppPrefsContext (setLanguage) which already
 *     fires `farroway:langchange` for live UI re-render.
 *   - Recently-used codes persist to localStorage key
 *     `farroway:recentLanguages` (max 3, most-recent first).
 *
 * Pure render. SSR-safe. iOS-safe-area honored. Above the bottom-nav
 * + safe-area inset so the sheet is never clipped.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { SUPPORTED_LOCALES, getLaunchLocales } from '../../i18n/supportedLocales.ts';
import { isFeatureEnabled } from '../../config/features.js';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _hasWindow = () =>
  _safe(() => typeof window !== 'undefined' && !!window, false);

const RECENT_KEY = 'farroway:recentLanguages';
const MAX_RECENT = 3;

function _loadRecent() {
  if (!_hasWindow()) return [];
  return _safe(() => {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((c) => typeof c === 'string') : [];
  }, []);
}

function _saveRecent(code) {
  if (!_hasWindow()) return;
  _safe(() => {
    const cur = _loadRecent();
    const next = [code, ...cur.filter((c) => c !== code)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, null);
}

export default function LanguageBottomSheet({ open, onClose }) {
  const { language, setLanguage } = useAppPrefs();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(_loadRecent);
  const searchRef = useRef(null);

  // Refresh "recent" list when the sheet opens — captures changes made
  // since last mount (e.g. user picked via a different surface).
  useEffect(() => {
    if (!open) return;
    setRecent(_loadRecent());
    setQuery('');
    // Focus the search field after the sheet animates in.
    const t = setTimeout(() => {
      _safe(() => { if (searchRef.current) searchRef.current.focus(); }, null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  // Esc-to-close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    if (_hasWindow()) window.addEventListener('keydown', onKey);
    return () => {
      if (_hasWindow()) window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const allLanguages = useMemo(() =>
    getLaunchLocales({
      enableHindi: isFeatureEnabled('enableHindiLocale'),
    }),
    []);

  const recentLanguages = useMemo(() => {
    const set = new Set(allLanguages.map((l) => l.code));
    return recent
      .filter((c) => set.has(c) && c !== language)
      .map((c) => allLanguages.find((l) => l.code === c))
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  }, [recent, allLanguages, language]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLanguages;
    return allLanguages.filter((l) =>
      l.code.toLowerCase().includes(q)
      || l.englishName.toLowerCase().includes(q)
      || l.nativeName.toLowerCase().includes(q));
  }, [query, allLanguages]);

  function pick(code) {
    _safe(() => setLanguage(code), null);
    _saveRecent(code);
    setRecent(_loadRecent());
    onClose && onClose();
  }

  if (!open) return null;
  if (!_hasWindow()) return null;
  const target = document.body;
  if (!target) return null;

  return createPortal(
    <div
      style={S.scrim}
      data-testid="language-sheet-scrim"
      onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose your language"
        style={S.sheet}
        data-testid="language-bottom-sheet"
      >
        <div style={S.handle} aria-hidden="true" />
        <header style={S.header}>
          <h2 style={S.title}>
            {tSafe('language.sheet.title', 'Choose your language')}
          </h2>
          <button
            type="button"
            style={S.closeBtn}
            onClick={onClose}
            aria-label={tSafe('language.sheet.close', 'Close')}
            data-testid="language-sheet-close"
          >
            ×
          </button>
        </header>

        <div style={S.searchRow}>
          <input
            ref={searchRef}
            type="search"
            placeholder={tSafe('language.sheet.search', 'Search languages')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={S.search}
            data-testid="language-sheet-search"
            aria-label={tSafe('language.sheet.search', 'Search languages')}
          />
        </div>

        {recentLanguages.length > 0 && !query ? (
          <section style={S.section} data-testid="language-sheet-recent">
            <h3 style={S.sectionTitle}>
              {tSafe('language.sheet.recent', 'Recently used')}
            </h3>
            <ul style={S.list}>
              {recentLanguages.map((l) => (
                <li key={'recent-' + l.code}>
                  <button
                    type="button"
                    style={S.itemBtn}
                    onClick={() => pick(l.code)}
                    data-testid={'language-sheet-pick-recent-' + l.code}
                  >
                    <span style={S.itemNative}>{l.nativeName}</span>
                    <span style={S.itemEnglish}>{l.englishName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section style={S.section} data-testid="language-sheet-list">
          <h3 style={S.sectionTitle}>
            {query
              ? tSafe('language.sheet.results', 'Results')
              : tSafe('language.sheet.all', 'All languages')}
          </h3>
          {filtered.length === 0 ? (
            <p style={S.empty}>
              {tSafe('language.sheet.noResults', 'No languages match.')}
            </p>
          ) : (
            <ul style={S.list}>
              {filtered.map((l) => {
                const isActive = l.code === language;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      style={isActive ? S.itemBtnActive : S.itemBtn}
                      onClick={() => pick(l.code)}
                      data-testid={'language-sheet-pick-' + l.code}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span style={S.itemNative}>{l.nativeName}</span>
                      <span style={S.itemEnglish}>{l.englishName}</span>
                      {isActive ? (
                        <span style={S.checkMark} aria-hidden="true">✓</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>,
    target,
  );
}

const S = {
  scrim: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,30,0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadein 200ms ease-out',
  },
  sheet: {
    background: '#FFFFFF',
    width: '100%',
    maxWidth: 540,
    maxHeight: '85vh',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -8px 24px rgba(15,23,30,0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  handle: {
    width: 40,
    height: 4,
    background: 'rgba(31,41,51,0.18)',
    borderRadius: 999,
    margin: '4px auto 12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#1F2933',
    margin: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1px solid rgba(31,41,51,0.10)',
    background: '#F1F5F9',
    color: '#1F2933',
    fontSize: 20,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  searchRow: {
    marginBottom: 12,
  },
  search: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16, // 16px prevents iOS Safari zoom-on-focus.
    borderRadius: 12,
    border: '1px solid rgba(31,41,51,0.12)',
    background: '#F8FAFC',
    color: '#1F2933',
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 6px',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  itemBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52, // ≥ 44 px tap-target rule from Design System §1.4
    padding: '12px 14px',
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.06)',
    borderRadius: 12,
    marginBottom: 8,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#1F2933',
    WebkitTapHighlightColor: 'transparent',
  },
  itemBtnActive: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    padding: '12px 14px',
    background: 'rgba(31,77,44,0.06)',
    border: '1.5px solid #1F4D2C',
    borderRadius: 12,
    marginBottom: 8,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#1F4D2C',
    fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  itemNative: { fontSize: 16, fontWeight: 600, flex: 1 },
  itemEnglish: { fontSize: 13, color: '#64748B', marginLeft: 8 },
  checkMark: {
    fontSize: 16,
    color: '#1F4D2C',
    fontWeight: 800,
    marginLeft: 8,
  },
  empty: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 0',
  },
};
