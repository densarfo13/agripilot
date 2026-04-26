/**
 * NotificationPreferencesCard — lightweight settings panel for the
 * per-user notification preferences stored under
 * farroway.notificationPrefs.v1.
 *
 * Mobile-first toggles; dark Farroway theme. Saves on every change
 * (no explicit "Save" button) so the settings always reflect what's
 * on screen.
 */

import { useEffect, useState } from 'react';
import {
  getNotificationPreferences, setNotificationPreferences,
} from '../lib/notifications/notificationPreferences.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';

function Toggle({ label, helper, value, onChange, testid }) {
  return (
    <label style={S.row}>
      <div style={S.labelCol}>
        <div style={S.label}>{label}</div>
        {helper && <div style={S.helper}>{helper}</div>}
      </div>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        style={S.checkbox}
        data-testid={testid}
      />
    </label>
  );
}

export default function NotificationPreferencesCard() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState(null);

  useEffect(() => { setPrefs(getNotificationPreferences()); }, []);

  if (!prefs) return null;
  const update = (patch) => setPrefs(setNotificationPreferences(patch));

  return (
    <div style={S.wrap} data-testid="notification-prefs-card">
      <div style={S.title}>
        {tSafe('notif.prefs.title', '')}
      </div>
      <div style={S.subtitle}>
        {tSafe('notif.prefs.subtitle', '')}
      </div>

      <Toggle
        label={tSafe('notif.prefs.daily', '')}
        helper={tSafe('notif.prefs.dailyHelper', '')}
        value={prefs.dailyReminderEnabled}
        onChange={(v) => update({ dailyReminderEnabled: v })}
        testid="notif-pref-daily"
      />

      <Toggle
        label={tSafe('notif.prefs.weather', '')}
        helper={tSafe('notif.prefs.weatherHelper', '')}
        value={prefs.weatherAlertsEnabled}
        onChange={(v) => update({ weatherAlertsEnabled: v })}
        testid="notif-pref-weather"
      />

      <Toggle
        label={tSafe('notif.prefs.risk', '')}
        helper={tSafe('notif.prefs.riskHelper', '')}
        value={prefs.riskAlertsEnabled}
        onChange={(v) => update({ riskAlertsEnabled: v })}
        testid="notif-pref-risk"
      />

      <Toggle
        label={tSafe('notif.prefs.missed', '')}
        helper={tSafe('notif.prefs.missedHelper', '')}
        value={prefs.missedTaskRemindersEnabled}
        onChange={(v) => update({ missedTaskRemindersEnabled: v })}
        testid="notif-pref-missed"
      />

      <div style={S.sep} />

      <Toggle
        label={tSafe('notif.prefs.email', '')}
        value={prefs.emailEnabled}
        onChange={(v) => update({ emailEnabled: v })}
        testid="notif-pref-email"
      />

      <Toggle
        label={tSafe('notif.prefs.sms', '')}
        helper={tSafe('notif.prefs.smsHelper', '')}
        value={prefs.smsEnabled}
        onChange={(v) => update({ smsEnabled: v })}
        testid="notif-pref-sms"
      />

      <label style={S.row}>
        <div style={S.labelCol}>
          <div style={S.label}>
            {tSafe('notif.prefs.reminderTime', '')}
          </div>
          <div style={S.helper}>
            {tSafe('notif.prefs.reminderTimeHelper', '')}
          </div>
        </div>
        <input
          type="time"
          value={prefs.preferredReminderTime}
          onChange={(e) => update({ preferredReminderTime: e.target.value })}
          style={S.timeInput}
          data-testid="notif-pref-time"
        />
      </label>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%', background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '1rem 1.125rem',
    color: '#fff', marginTop: '1rem',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },
  subtitle: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)',
              marginBottom: '1rem', marginTop: '0.125rem' },
  row: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
         gap: '1rem', padding: '0.625rem 0' },
  labelCol: { display: 'flex', flexDirection: 'column', gap: '0.125rem', flex: 1 },
  label:  { fontSize: '0.875rem', color: '#F8FAFC', fontWeight: 600 },
  helper: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 },
  checkbox: { width: '20px', height: '20px', accentColor: '#22C55E', cursor: 'pointer' },
  timeInput: {
    background: '#0B1525', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '0.375rem 0.5rem', color: '#fff',
    fontSize: '0.875rem', colorScheme: 'dark',
  },
  sep: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.75rem 0' },
};
