/**
 * Frontend i18n utility
 * Fetches translations from the backend and provides a translate function.
 * Uses localStorage to cache translations and remember language preference.
 *
 * Translations are loaded at app startup (App.jsx) and on language switch.
 * All t*() functions return fallback English if translations haven't loaded.
 */

// Global Multilingual System §1 — initial-language orchestrator.
// Pure + sync + never throws; consulted exactly once at module
// init below. Top-level ESM import (Vite is ESM-only).
import { detectInitialLanguage } from './autoDetectLanguage.js';

// Detect Capacitor native platform for correct API base URL.
// VITE_API_BASE_URL is the canonical env name (see src/config/env.js);
// VITE_API_URL stays honoured for backward compat with older deploys.
const cap = typeof window !== 'undefined' && window.Capacitor;
const isNative = cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNativePlatform);
const _API_BASE_ENV = (typeof import.meta !== 'undefined'
  && (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL));
const API_BASE = isNative
  ? (_API_BASE_ENV || 'https://farroway.app/api')
  : (_API_BASE_ENV || '/api');

// Global Multilingual System §1 — initial language picked via
// the autoDetectLanguage orchestrator (priority: stored pref →
// navigator.language → location-derived → 'en'). On a fresh
// install this lets a French-speaking user land in French
// without any manual toggle. Existing users are unaffected
// because their stored value still wins.
//
// Lazy import would be cleaner but this file is consumed
// synchronously at module init by other surfaces — top-level
// import keeps the call chain simple. The orchestrator itself
// is pure + never throws.
let currentLang;
try {
  // The orchestrator handles all storage / browser checks itself
  // and never throws; this outer try/catch is a belt-and-braces
  // guard for the truly-pathological "module load failed" case
  // (test fixtures with no localStorage shim).
  currentLang = detectInitialLanguage();
} catch {
  try { currentLang = localStorage.getItem('farroway_lang') || 'en'; }
  catch { currentLang = 'en'; }
}
// Mirror the resolved language into localStorage so the rest of
// the app reads a consistent value (existing
// `getCurrentLang()` consumers, the LanguageSwitcher, etc).
try { if (currentLang) localStorage.setItem('farroway_lang', currentLang); }
catch { /* SSR / locked-down */ }
let translations = {};
let loaded = false;

export function getCurrentLang() {
  return currentLang;
}

export async function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('farroway_lang', lang);
  await loadTranslations(lang);
}

export async function loadTranslations(lang = currentLang) {
  try {
    const resp = await fetch(`${API_BASE}/localization/translations/${lang}`);
    if (resp.ok) {
      translations = await resp.json();
      loaded = true;
    }
  } catch (e) {
    console.warn('[i18n] Failed to load translations:', e);
    // Fallbacks in each t*() function will handle this gracefully
  }
}

export function t(key, fallback) {
  return translations[key] || fallback || key;
}

export function tStatus(status) {
  return t('status.' + status, status?.replace(/_/g, ' '));
}

export function tRole(role) {
  return t('role.' + role, role?.replace(/_/g, ' '));
}

export function tCrop(crop) {
  return t('crop.' + crop?.toLowerCase(), crop);
}

export function tActivity(type) {
  return t('activity.' + type, type?.replace(/_/g, ' '));
}

export function tLifecycleStage(stage) {
  return t('lifecycle.' + stage, stage?.replace(/_/g, ' '));
}

export function tStorageMethod(method) {
  return t('storage.method.' + method, method?.replace(/_/g, ' '));
}

export function tStorageCondition(condition) {
  return t('storage.condition.' + condition, condition?.replace(/_/g, ' '));
}

export function tFraudRisk(level) {
  return t('fraud.risk.' + level, level?.replace(/_/g, ' '));
}

export function tNav(key) {
  return t('nav.' + key, key?.replace(/_/g, ' '));
}

export function isLoaded() {
  return loaded;
}
