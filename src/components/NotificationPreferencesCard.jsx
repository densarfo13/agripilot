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
        {t('notif.prefs.title') || 'Notification settings'}
      </div>
      <div style={S.subtitle}>
        {t('notif.prefs.subtitle')
          || 'Pick when and how Farroway can reach you.'}
      </div>

      <Toggle
        label={t('notif.prefs.daily') || 'Daily task reminders'}
        helper={t('notif.prefs.dailyHelper')
          || 'One short nudge when today\u2019s task is ready.'}
        value={prefs.dailyReminderEnabled}
        onChange={(v) => update({ dailyReminderEnabled: v })}
        testid="notif-pref-daily"
      />

      <Toggle
        label={t('notif.prefs.weather') || 'Weather alerts'}
        helper={t('notif.prefs.weatherHelper')
          || 'Dry spells, heavy rain and heat alerts for your farm.'}
        value={prefs.weatherAlertsEnabled}
        onChange={(v) => update({ weatherAlertsEnabled: v })}
        testid="notif-pref-weather"
      />

      <Toggle
        label={t('notif.prefs.risk') || 'Risk alerts'}
        helper={t('notif.prefs.riskHelper')
          || 'Heads-up when pest, disease or water stress risk rises.'}
        value={prefs.riskAlertsEnabled}
        onChange={(v) => update({ riskAlertsEnabled: v })}
        testid="notif-pref-risk"
      />

      <Toggle
        label={t('notif.prefs.missed') || 'Missed task reminders'}
        helper={t('notif.prefs.missedHelper')
          || 'A soft nudge when a few tasks slip by.'}
        value={prefs.missedTaskRemindersEnabled}
        onChange={(v) => update({ missedTaskRemindersEnabled: v })}
        testid="notif-pref-missed"
      />

      <div style={S.sep} />

      <Toggle
        label={t('notif.prefs.email') || 'Email notifications'}
        value={prefs.emailEnabled}
        onChange={(v) => update({ emailEnabled: v })}
        testid="notif-pref-email"
      />

      <Toggle
        label={t('notif.prefs.sms') || 'SMS notifications'}
        helper={t('notif.prefs.smsHelper')
          || 'Short text messages for urgent alerts only.'}
        value={prefs.smsEnabled}
        onChange={(v) => update({ smsEnabled: v })}
        testid="notif-pref-sms"
      />

      <label style={S.row}>
        <div style={S.labelCol}>
          <div style={S.label}>
            {t('notif.prefs.reminderTime') || 'Preferred reminder time'}
          </div>
          <div style={S.helper}>
            {t('notif.prefs.reminderTimeHelper')
              || 'We aim to send the daily nudge around this time.'}
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
