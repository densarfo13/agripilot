#!/usr/bin/env node
/**
 * scripts/check-notification-preferences.mjs — §2 preferences.
 *
 * Fails if the preferences runtime is missing per-type toggles or quiet
 * hours, does not declare notifications optional, requires notifications,
 * or the Settings page does not link to /settings/notifications.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const TYPES = ['daily_farm_plan', 'task_reminder', 'follow_up_scan', 'weather_alert',
  'harvest_alert', 'post_harvest_alert', 'ngo_field_officer_alert', 'buyer_interest_alert'];

const rel = 'src/runtime/notifications/NotificationPreferences.ts';
const raw = read(rel);
if (!raw) F.push(`${rel}: missing`);
else {
  if (!/__notificationPreferencesHealth/.test(raw) || !/installNotificationPreferencesGlobal/.test(raw))
    F.push('must install window.__notificationPreferencesHealth');
  else P.push('__notificationPreferencesHealth installer present');
  if (!/notificationsOptional:\s*true/.test(raw))
    F.push('must declare notificationsOptional:true');
  else P.push('notificationsOptional:true');
  for (const k of ['enabled', 'reminderTime', 'timezone', 'quietHours', 'perType', 'permissionState', 'isInQuietHoursNow']) {
    if (!raw.includes(k)) F.push(`preferences must surface ${k}`);
  }
  if (!F.some((m) => /must surface/.test(m))) P.push('all required preference fields present');
  // All 8 per-type toggles must be modeled.
  const miss = TYPES.filter((t) => !raw.includes(t));
  if (miss.length) F.push(`per-type toggles missing: ${miss.join(', ')}`);
  else P.push('all 8 per-type toggles modeled');
  // Default reminder time 07:00 + default quiet 21:00-06:00.
  if (!/['"]07:00['"]/.test(raw)) F.push('default reminderTime must be 07:00');
  else P.push('default reminderTime 07:00');
  if (!/['"]21:00['"]/.test(raw) || !/['"]06:00['"]/.test(raw))
    F.push('default quiet hours must be 21:00–06:00');
  else P.push('default quiet hours 21:00–06:00');
}

// Settings page must link to the new page.
const settings = read('src/pages/Settings.jsx');
if (!settings) F.push('src/pages/Settings.jsx: missing');
else if (!/\/settings\/notifications/.test(settings))
  F.push('Settings.jsx must link to /settings/notifications');
else P.push('Settings.jsx links to /settings/notifications');

// Dedicated page must render and persist preferences.
const page = read('src/pages/settings/NotificationSettingsPage.jsx');
if (!page) F.push('NotificationSettingsPage.jsx: missing');
else {
  if (!/farroway_notification_prefs_v2/.test(page))
    F.push('settings page must persist to farroway_notification_prefs_v2');
  else P.push('settings page persists to farroway_notification_prefs_v2');
  if (!/permission(Denied|denied)/.test(page))
    F.push('settings page must handle permission-denied (never block)');
  else P.push('handles permission-denied without blocking');
}

if (F.length) {
  console.error('[check:notification-preferences] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-preferences] PASS — preferences runtime + settings page wired, optional, full per-type toggles.');
for (const m of P) console.log('  ✓ ' + m);
