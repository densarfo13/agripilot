/**
 * NotificationSettingsPage.jsx — full notification preferences UI.
 *
 *   <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
 *
 * Lets the user configure: enable/disable, reminder time, timezone, quiet
 * hours, and a per-type toggle for each of the 8 notification kinds. Writes
 * to localStorage 'farroway_notification_prefs_v2' (the additive key the
 * NotificationPreferences diagnostic runtime reads).
 *
 * NEVER blocks the app: when the browser denies notification permission the
 * page still renders and the user can still toggle their stored preferences.
 * Notifications stay OPTIONAL by design.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const PREFS_KEY = 'farroway_notification_prefs_v2';
const DEFAULT_QUIET = Object.freeze({ start: '21:00', end: '06:00' });
const DEFAULT_REMINDER_TIME = '07:00';
const TYPES = Object.freeze([
  'daily_farm_plan', 'task_reminder', 'follow_up_scan', 'weather_alert',
  'harvest_alert', 'post_harvest_alert', 'ngo_field_officer_alert',
  'buyer_interest_alert',
]);
const DEFAULT_PER_TYPE = Object.freeze({
  daily_farm_plan: true, task_reminder: true, follow_up_scan: true,
  weather_alert: true, harvest_alert: true, post_harvest_alert: true,
  ngo_field_officer_alert: false, buyer_interest_alert: false,
});

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readPrefs() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && typeof p === 'object') ? p : null;
  }, null);
}

function _writePrefs(next) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return true;
  }, false);
}

function _detectTimezone() {
  return _safe(() => {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return 'UTC';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  }, 'UTC');
}

function _detectPermission() {
  return _safe(() => {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return 'unsupported';
    return window.Notification.permission || 'default';
  }, 'unsupported');
}

export default function NotificationSettingsPage() {
  // Initial state — merge stored prefs over defaults so a missing field
  // falls back honestly.
  const initial = useMemo(() => {
    const stored = _readPrefs() || {};
    return {
      enabled: stored.enabled !== false,
      reminderTime: (typeof stored.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(stored.reminderTime))
        ? stored.reminderTime : DEFAULT_REMINDER_TIME,
      timezone: stored.timezone || _detectTimezone(),
      quietHours: (stored.quietHours && typeof stored.quietHours === 'object')
        ? { start: stored.quietHours.start || DEFAULT_QUIET.start, end: stored.quietHours.end || DEFAULT_QUIET.end }
        : { ...DEFAULT_QUIET },
      perType: { ...DEFAULT_PER_TYPE, ...((stored.perType && typeof stored.perType === 'object') ? stored.perType : {}) },
    };
  }, []);

  const [prefs, setPrefs] = useState(initial);
  const [savedAt, setSavedAt] = useState(null);
  const [permission, setPermission] = useState(_detectPermission());

  // Persist on every change (debounced inline).
  useEffect(() => {
    const t = setTimeout(() => {
      if (_writePrefs(prefs)) setSavedAt(Date.now());
    }, 250);
    return () => clearTimeout(t);
  }, [prefs]);

  const requestPermission = () => _safe(async () => {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
    if (typeof window.Notification.requestPermission !== 'function') return;
    const next = await window.Notification.requestPermission();
    setPermission(next || 'default');
  }, null);

  const togglePerType = (key) =>
    setPrefs((p) => ({ ...p, perType: { ...p.perType, [key]: !p.perType[key] } }));

  return (
    <main style={S.page} data-testid="settings-notifications">
      <header style={S.head}>
        <h1 style={S.title}>{tSafe('notifications.title', 'Notifications')}</h1>
        <p style={S.sub}>{tSafe('notifications.subtitle',
          'Reminders work even when the app is closed. They are optional — the app works without them.')}</p>
      </header>

      {/* Permission banner — never blocks the page. */}
      {permission === 'denied' ? (
        <div style={{ ...S.banner, background: '#FEF3C7', color: '#92400E' }} data-testid="notif-permission-denied">
          {tSafe('notifications.permissionDenied',
            'Notifications are blocked in your browser. The app still works without them.')}
        </div>
      ) : permission !== 'granted' && permission !== 'unsupported' ? (
        <div style={S.banner} data-testid="notif-permission-prompt">
          <span>{tSafe('notifications.permissionPrompt', 'Allow notifications in your browser')}</span>
          <button type="button" style={S.btnSmall} onClick={requestPermission}>
            {tSafe('notifications.enable', 'Enable notifications')}
          </button>
        </div>
      ) : null}

      {/* Master switch */}
      <section style={S.card} data-testid="notif-master">
        <div style={S.row}>
          <label htmlFor="notif-enabled" style={S.label}>
            {tSafe('notifications.enable', 'Enable notifications')}
          </label>
          <input id="notif-enabled" type="checkbox" checked={prefs.enabled}
            onChange={(e) => setPrefs((p) => ({ ...p, enabled: e.target.checked }))} />
        </div>
        <p style={S.help}>{tSafe('notifications.optionalDisclaimer',
          'Notifications are optional. The app works without them.')}</p>
      </section>

      {/* Reminder time + timezone */}
      <section style={S.card} data-testid="notif-time">
        <div style={S.row}>
          <label htmlFor="notif-reminder-time" style={S.label}>
            {tSafe('notifications.reminderTime', 'Reminder time')}
          </label>
          <input id="notif-reminder-time" type="time" value={prefs.reminderTime}
            onChange={(e) => setPrefs((p) => ({ ...p, reminderTime: e.target.value || DEFAULT_REMINDER_TIME }))}
            style={S.input} />
        </div>
        <div style={S.row}>
          <label htmlFor="notif-tz" style={S.label}>
            {tSafe('notifications.timezone', 'Timezone')}
          </label>
          <input id="notif-tz" type="text" value={prefs.timezone}
            onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.target.value || 'UTC' }))}
            style={S.input} />
        </div>
      </section>

      {/* Quiet hours */}
      <section style={S.card} data-testid="notif-quiet">
        <h2 style={S.h2}>{tSafe('notifications.quietHours', 'Quiet hours')}</h2>
        <div style={S.row}>
          <label htmlFor="notif-quiet-start" style={S.label}>
            {tSafe('notifications.quietHoursStart', 'Quiet from')}
          </label>
          <input id="notif-quiet-start" type="time" value={prefs.quietHours.start}
            onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, start: e.target.value || DEFAULT_QUIET.start } }))}
            style={S.input} />
        </div>
        <div style={S.row}>
          <label htmlFor="notif-quiet-end" style={S.label}>
            {tSafe('notifications.quietHoursEnd', 'Quiet until')}
          </label>
          <input id="notif-quiet-end" type="time" value={prefs.quietHours.end}
            onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, end: e.target.value || DEFAULT_QUIET.end } }))}
            style={S.input} />
        </div>
      </section>

      {/* Per-type toggles */}
      <section style={S.card} data-testid="notif-per-type">
        <h2 style={S.h2}>{tSafe('notifications.perTypeHeading', 'Types of reminders')}</h2>
        {TYPES.map((k) => (
          <div key={k} style={S.row}>
            <label htmlFor={`notif-${k}`} style={S.label}>
              {tSafe(`notifications.type.${k}`, k.replace(/_/g, ' '))}
            </label>
            <input id={`notif-${k}`} type="checkbox" checked={!!prefs.perType[k]}
              onChange={() => togglePerType(k)}
              data-testid={`notif-toggle-${k}`} />
          </div>
        ))}
      </section>

      {savedAt ? (
        <p style={S.saved} aria-live="polite" data-testid="notif-saved">
          {tSafe('notifications.savedToast', 'Saved.')}
        </p>
      ) : null}
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px',
    fontFamily: 'system-ui', color: '#1F2937', background: '#F9FAFB' },
  head: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { fontSize: 13, color: '#4B5563', margin: '6px 0 0' },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: '#E0E7FF', color: '#3730A3', padding: '10px 14px', borderRadius: 10,
    fontSize: 13, marginBottom: 16 },
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
    padding: '14px 16px', marginBottom: 12 },
  h2: { fontSize: 14, fontWeight: 700, margin: '0 0 8px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '6px 0' },
  label: { fontSize: 14, color: '#1F2937', flex: 1 },
  input: { fontSize: 14, padding: '6px 10px', border: '1px solid #D1D5DB',
    borderRadius: 8, background: '#FFFFFF', minWidth: 120 },
  help: { fontSize: 12, color: '#6B7280', margin: '4px 0 0' },
  btnSmall: { fontSize: 12, fontWeight: 700, padding: '6px 12px', border: '1px solid #6366F1',
    background: '#EEF2FF', color: '#3730A3', borderRadius: 999, cursor: 'pointer' },
  saved: { fontSize: 12, color: '#15803D', fontWeight: 700, margin: '8px 0 0' },
};
