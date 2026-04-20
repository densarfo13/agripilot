/**
 * NotificationSettingsPanel — small, self-contained block for the
 * Settings page. Reads/writes farroway.notificationSettings via the
 * reminderEngine helpers.
 *
 * Controls:
 *   • Daily reminders            on/off
 *   • Reminder time              HH:MM
 *   • Browser notifications      on/off  (triggers prompt if 'default')
 *   • Email reminders            on/off  (stored for later)
 *   • Critical alerts only       on/off
 *
 * Layout intentionally mirrors the existing FarmerSettingsPanel —
 * no redesign, just a new block below it on the Settings page.
 */
import { useEffect, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext.jsx';
import {
  getSettings, updateSettings, requestBrowserPush,
} from '../lib/notifications/reminderEngine.js';

export default function NotificationSettingsPanel() {
  const { t } = useAppSettings();
  const [settings, setSettings] = useState(() => getSettings());
  const [permState, setPermState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  useEffect(() => {
    // Keep in sync if another tab changes things.
    function onStorage(e) {
      if (!e || e.key !== 'farroway.notificationSettings') return;
      setSettings(getSettings());
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }, []);

  function patch(p) {
    const next = updateSettings(p);
    setSettings(next);
  }

  async function handleToggleBrowserPush(e) {
    const want = e.target.checked;
    if (!want) { patch({ browserPushEnabled: false }); return; }
    if (typeof Notification === 'undefined') {
      patch({ browserPushEnabled: false, askedBrowserPermission: true });
      setPermState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      patch({ browserPushEnabled: true, askedBrowserPermission: true });
      return;
    }
    if (Notification.permission === 'denied') {
      patch({ browserPushEnabled: false, askedBrowserPermission: true });
      return;
    }
    const result = await requestBrowserPush();
    setPermState(result === 'granted' ? 'granted' : 'denied');
    setSettings(getSettings());
  }

  const browserDisabled = permState === 'denied' || permState === 'unsupported';
  const hint = permState === 'denied'
    ? (t('settings.notifications.permissionDenied') || 'Notifications blocked by the browser.')
    : permState === 'unsupported'
      ? (t('settings.notifications.unsupported') || 'This browser does not support notifications.')
      : null;

  return (
    <section style={S.panel} data-testid="notification-settings">
      <h2 style={S.h2}>{t('settings.notifications.title') || 'Notifications'}</h2>

      <Row
        label={t('settings.notifications.daily') || 'Daily reminders'}
        testId="notif-daily"
      >
        <Toggle
          checked={settings.dailyReminderEnabled}
          onChange={(e) => patch({ dailyReminderEnabled: e.target.checked })}
        />
      </Row>

      <Row
        label={t('settings.notifications.time') || 'Reminder time'}
        testId="notif-time"
      >
        <input
          type="time"
          value={settings.dailyReminderTime}
          onChange={(e) => patch({ dailyReminderTime: e.target.value })}
          style={S.input}
          data-testid="notif-time-input"
        />
      </Row>

      <Row
        label={t('settings.notifications.browser') || 'Browser notifications'}
        testId="notif-browser"
      >
        <Toggle
          checked={settings.browserPushEnabled && !browserDisabled}
          onChange={handleToggleBrowserPush}
          disabled={browserDisabled}
        />
      </Row>
      {hint && <p style={S.hint} data-testid="notif-browser-hint">{hint}</p>}

      <Row
        label={t('settings.notifications.email') || 'Email reminders'}
        testId="notif-email"
      >
        <Toggle
          checked={settings.emailReminderEnabled}
          onChange={(e) => patch({ emailReminderEnabled: e.target.checked })}
        />
      </Row>

      <Row
        label={t('settings.notifications.criticalOnly') || 'Critical alerts only'}
        testId="notif-critical"
      >
        <Toggle
          checked={settings.criticalAlertsOnly}
          onChange={(e) => patch({ criticalAlertsOnly: e.target.checked })}
        />
      </Row>
    </section>
  );
}

function Row({ label, children, testId }) {
  return (
    <div style={S.row} data-testid={testId}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <label style={{
      ...S.toggleLabel,
      ...(disabled ? S.toggleDisabled : null),
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={S.toggleInput}
      />
      <span style={{
        ...S.toggleTrack,
        ...(checked ? S.toggleTrackOn : null),
        ...(disabled ? { opacity: 0.5 } : null),
      }}>
        <span style={{
          ...S.toggleThumb,
          ...(checked ? S.toggleThumbOn : null),
        }} />
      </span>
    </label>
  );
}

const S = {
  panel: {
    padding: '1rem 1.25rem',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  h2: { margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#EAF2FF' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.75rem',
  },
  label: { fontSize: '0.875rem', color: '#EAF2FF', fontWeight: 500 },
  input: {
    padding: '0.375rem 0.5rem', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#fff',
    fontSize: '0.875rem',
  },
  hint: { margin: 0, fontSize: '0.75rem', color: '#9FB3C8' },
  toggleLabel: {
    position: 'relative', display: 'inline-block',
    width: '2.5rem', height: '1.375rem',
    cursor: 'pointer',
  },
  toggleDisabled: { cursor: 'not-allowed' },
  toggleInput: {
    opacity: 0, width: 0, height: 0, position: 'absolute',
  },
  toggleTrack: {
    position: 'absolute', inset: 0, borderRadius: '999px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.14)',
    transition: 'background 0.15s ease',
  },
  toggleTrackOn: {
    background: 'rgba(34,197,94,0.42)',
    borderColor: 'rgba(34,197,94,0.6)',
  },
  toggleThumb: {
    position: 'absolute', top: '2px', left: '2px',
    width: '1rem', height: '1rem', borderRadius: '50%',
    background: '#EAF2FF',
    transition: 'transform 0.15s ease',
  },
  toggleThumbOn: {
    transform: 'translateX(1.125rem)',
  },
};
