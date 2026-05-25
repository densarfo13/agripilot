/**
 * intelligenceTemplates/index.js — single import point for every
 * intelligence-output template.
 *
 *   import {
 *     diseaseAlertTemplate, weatherWarningTemplate,
 *     wateringAlertTemplate, harvestAlertTemplate,
 *     marketplacePromptTemplate, supplierPromptTemplate,
 *   } from 'src/core/i18n/intelligenceTemplates';
 *
 *   const env = diseaseAlertTemplate({ severity: 'high', crop: 'tomato' });
 *   // env = { key: 'intelligence.disease.high', fallback: '...', params: {...} }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Each template returns a `{ key, fallback, params }` envelope
 *   so the i18n layer (tSafe / tStrict / useTranslation) resolves
 *   the final string in the active locale.
 *
 *   The templates DO NOT call t() themselves — they hand the
 *   envelope to the surface, which is responsible for translation.
 *   This keeps the engines pure + testable without spinning up the
 *   i18n module.
 *
 *   Spec rule: "All intelligence output must support localization.
 *   No raw English generation allowed." Every template here returns
 *   an envelope — no raw English strings escape.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every envelope has a `key` (so the column files / overlay
 *     files can localise it) AND a `fallback` (so a missing key
 *     never renders blank).
 */

import { diseaseAlertTemplate } from './diseaseAlertTemplate.js';
import { weatherWarningTemplate } from './weatherWarningTemplate.js';
import { wateringAlertTemplate } from './wateringAlertTemplate.js';
import { harvestAlertTemplate } from './harvestAlertTemplate.js';
import { marketplacePromptTemplate } from './marketplacePromptTemplate.js';
import { supplierPromptTemplate } from './supplierPromptTemplate.js';

export {
  diseaseAlertTemplate,
  weatherWarningTemplate,
  wateringAlertTemplate,
  harvestAlertTemplate,
  marketplacePromptTemplate,
  supplierPromptTemplate,
};

const _module = {
  diseaseAlertTemplate, weatherWarningTemplate, wateringAlertTemplate,
  harvestAlertTemplate, marketplacePromptTemplate, supplierPromptTemplate,
};
export default _module;
