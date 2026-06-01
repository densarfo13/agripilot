#!/usr/bin/env node
/**
 * scripts/check-notification-localization.mjs — §13 localization.
 *
 * Fails if any notification template is hard-coded English, if the 7
 * notification namespaces are not defined, or if the i18n overlay is not
 * registered into the dictionary. English-only base (other locales fall
 * back) is fine — but every template must go through tSafe at the call
 * site and have an i18n key.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const NS = ['notifications', 'dailyPlanNotif', 'tasksNotif', 'weatherNotif',
  'harvestNotif', 'ngoNotif', 'buyerNotif'];

const pack = read('src/i18n/notificationTranslations.js');
if (!pack) F.push('src/i18n/notificationTranslations.js: missing');
else {
  const missing = NS.filter((n) => !new RegExp(`'${n}\\.`).test(pack));
  if (missing.length) F.push(`notification namespaces missing keys: ${missing.join(', ')}`);
  else P.push('all 7 namespaces present');
  if (!/NOTIFICATION_TRANSLATIONS/.test(pack)) F.push('must export NOTIFICATION_TRANSLATIONS overlay');
  else P.push('overlay exported');
  if (/\b(tw|ha|fr|sw|hi)\s*:/.test(pack))
    F.push('pack must ship English only — other locales fall back (translator-review)');
  else P.push('English-only base (fallback for other locales)');
}

const idx = read('src/i18n/index.js');
if (!idx) F.push('src/i18n/index.js: missing');
else if (!/NOTIFICATION_TRANSLATIONS/.test(idx) || !/Object\.keys\(NOTIFICATION_TRANSLATIONS\)/.test(idx))
  F.push('NOTIFICATION_TRANSLATIONS must be imported AND merged in index.js');
else P.push('registered + merged into the i18n dictionary');

// The settings page must localize via tSafe, never hard-code English copy.
const page = read('src/pages/settings/NotificationSettingsPage.jsx');
if (!page) F.push('NotificationSettingsPage.jsx: missing');
else if (!/tSafe\(/.test(page)) F.push('settings page must localize copy via tSafe');
else P.push('settings page localizes via tSafe');

if (F.length) {
  console.error('[check:notification-localization] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-localization] PASS — 7 namespaces defined + registered, page via tSafe, English fallback only.');
for (const m of P) console.log('  ✓ ' + m);
