/**
 * NotificationSettingsCard — simple 3-toggle farmer preferences.
 *
 * Spec §9 keeps this minimal:
 *   - Daily reminders on/off
 *   - Weather alerts on/off
 *   - Critical alerts on/off
 *   - Reminder time (5–10 morning hours)
 *
 * Permission CTA surfaces only if the browser supports notifications
 * and the user hasn't granted yet. In-app banner on Home works
 * regardless of permission state.
 */
import { useState, useEffect } from 'react';
// Strict no-leak alias — every t() call here returns '' instead of
// English fallback when a key is missing in the active language.
// One-line reversal by swapping back to '../i18n/index.js'.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getPreferences, setPreferences } from '../services/notificationPreferences.js';
import { isSupported, getPermission, requestPermission } from '../services/notificationService.js';
import { safeTrackEvent } from '../lib/analytics.js';

export default function NotificationSettingsCard() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState(() => getPreferences());
  const [permission, setPermission] = useState(() => getPermission());

  useEffect(() => {
    setPrefs(getPreferences());
  }, []);

  function update(patch) {
    const merged = setPreferences(patch);
    setPrefs(merged);
    safeTrackEvent('notification.prefs_updated', { ...patch });
  }

  async function askPermission() {
    const result = await requestPermission();
    setPermission(result);
  }

  const supported = isSupported();

  return (
    <div style={S.card}>
      <div style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDD14'}</span>
        <div>
          <div style={S.title}>{t('notification.settings.title')}</div>
          <div style={S.subtitle}>{t('notification.settings.subtitle')}</div>
        </div>
      </div>

      {/* Toggles */}
      <Toggle
        label={t('notification.settings.daily')}
        hint={t('notification.settings.dailyHint')}
        checked={prefs.daily !== false}
        onChange={(v) => update({ daily: v })}
      />
      <Toggle
        label={t('notification.settings.weather')}
        hint={t('notification.settings.weatherHint')}
        checked={prefs.weather !== false}
        onChange={(v) => update({ weather: v })}
      />
      <Toggle
        label={t('notification.settings.critical')}
        hint={t('notification.settings.criticalHint')}
        checked={prefs.critical !== false}
        onChange={(v) => update({ critical: v })}
      />

      {/* Reminder time */}
      <div style={S.hourRow}>
        <div>
          <div style={S.toggleLabel}>{t('notification.settings.time')}</div>
          <div style={S.toggleHint}>{t('notification.settings.timeHint')}</div>
        </div>
        <select
          value={prefs.reminderHour || 7}
          onChange={(e) => update({ reminderHour: Number(e.target.value) })}
          style={S.select}
        >
          {[5, 6, 7, 8, 9, 10].map(h => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </div>

      {/* Permission nudge */}
      {supported && permission === 'default' && (
        <button type="button" onClick={askPermission} style={S.permissionBtn}>
          {t('notification.settings.enableBrowser')}
        </button>
      )}
      {supported && permission === 'denied' && (
        <div style={S.permissionDenied}>{t('notification.settings.deniedHint')}</div>
      )}
      {!supported && (
        <div style={S.permissionDenied}>{t('notification.settings.unsupportedHint')}</div>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div style={S.toggleRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.toggleLabel}>{label}</div>
        {hint && <div style={S.toggleHint}>{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ ...S.switch, ...(checked ? S.switchOn : {}) }}
      >
        <span style={{ ...S.switchDot, ...(checked ? S.switchDotOn : {}) }} />
      </button>
    </div>
  );
}

const S = {
  card: {
    width: '100%',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  icon: { fontSize: '1.5rem', lineHeight: 1 },
  title: { fontSize: '0.9375rem', fontWeight: 800, color: '#EAF2FF' },
  subtitle: { fontSize: '0.75rem', color: '#9FB3C8', marginTop: '0.125rem' },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  toggleLabel: { fontSize: '0.875rem', fontWeight: 700, color: '#EAF2FF' },
  toggleHint: { fontSize: '0.75rem', color: '#6F8299', marginTop: '0.125rem' },
  switch: {
    width: '44px', height: '26px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.18s ease',
    flexShrink: 0,
  },
  switchOn: {
    background: 'rgba(34,197,94,0.6)',
    borderColor: 'rgba(34,197,94,0.8)',
  },
  switchDot: {
    position: 'absolute',
    top: '3px', left: '3px',
    width: '18px', height: '18px',
    background: '#EAF2FF',
    borderRadius: '50%',
    transition: 'transform 0.18s ease',
  },
  switchDotOn: { transform: 'translateX(18px)' },
  hourRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  select: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#EAF2FF',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 600,
    outline: 'none',
  },
  permissionBtn: {
    padding: '0.75rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.18)',
  },
  permissionDenied: {
    padding: '0.625rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.14)',
    color: '#F59E0B',
    fontSize: '0.75rem',
    fontWeight: 600,
    textAlign: 'center',
  },
};
