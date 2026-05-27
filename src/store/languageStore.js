/**
 * languageStore.js — Zustand-persisted language single source of
 * truth (spec §6).
 *
 *   import { useLanguageStore, LANGUAGE_STORAGE_KEY }
 *     from 'src/store/languageStore.js';
 *
 *   const language = useLanguageStore((s) => s.language);
 *
 * What this is
 * ────────────
 *   Atomic language source for the app. Sits alongside the
 *   existing localeStorageBridge (which mirrors the 5 legacy
 *   keys for backward-compat); this is the new canonical
 *   that screens import going forward.
 *
 * Strict-rule audit
 *   • SSR-safe.
 *   • Never throws.
 *   • Compose-only — does NOT delete legacy keys (that work
 *     belongs to localeStorageBridge.writeBridgedLocale).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const LANGUAGE_STORAGE_KEY = 'farroway-language-v2';

const SUPPORTED = ['en', 'tw', 'ha', 'sw', 'hi', 'fr'];

function _safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    return createJSONStorage(() => window.localStorage);
  } catch {
    return undefined;
  }
}

function _coerce(code) {
  if (typeof code !== 'string') return 'en';
  const base = code.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : 'en';
}

export const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language: _coerce(language) }),
    }),
    {
      name:    LANGUAGE_STORAGE_KEY,
      storage: _safeStorage(),
      version: 2,
    },
  ),
);

const _module = { useLanguageStore, LANGUAGE_STORAGE_KEY };
export default _module;
