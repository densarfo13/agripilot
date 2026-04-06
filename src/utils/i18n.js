/**
 * Frontend i18n utility
 * Fetches translations from the backend and provides a translate function.
 * Uses localStorage to cache translations and remember language preference.
 */

let currentLang = localStorage.getItem('agripilot_lang') || 'en';
let translations = {};
let loaded = false;

export function getCurrentLang() {
  return currentLang;
}

export async function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('agripilot_lang', lang);
  await loadTranslations(lang);
}

export async function loadTranslations(lang = currentLang) {
  try {
    const resp = await fetch(`/api/localization/translations/${lang}`);
    if (resp.ok) {
      translations = await resp.json();
      loaded = true;
    }
  } catch (e) {
    console.warn('Failed to load translations:', e);
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
