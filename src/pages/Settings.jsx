/**
 * Settings — unified, farmer-facing settings page mounted at /settings.
 *
 * Sections:
 *   A. Notifications     — daily / weather / risk / missed
 *   B. Communication     — email / sms / reminder time
 *   C. Farmer ID         — farmerUuid + copy button
 *
 * Persistence:
 *   src/store/settingsStore.js  →  localStorage[`farroway_settings`]
 *
 * No backend or notification-engine change. UI cleanup +
 * persistence only. Visible labels go through the bound `tSafe`
 * pattern that the rest of the app already uses, so when an
 * overlay key is missing the fallback string lands instead of a
 * humanized leak.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { useProfile } from '../context/ProfileContext.jsx';
import {
  loadSettings, updateSetting, SETTINGS_CHANGE_EVENT,
} from '../store/settingsStore.js';
// Logout + reset flows. Both modules are pure storage utilities;
// the buttons wire them through a ConfirmModal so a stray tap
// can't wipe a farmer's data.
import { logout } from '../utils/logout.js';
import { resetApp } from '../utils/resetApp.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [settings, setSettings] = useState(() => loadSettings());
  const [copied, setCopied] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [resetOpen,  setResetOpen]  = useState(false);

  // Sync across tabs / cross-component updates.
  useEffect(() => {
    function onChange(e) {
      setSettings((e && e.detail) ? e.detail : loadSettings());
    }
    function onStorage(e) {
      if (!e || e.key !== 'farroway_settings') return;
      setSettings(loadSettings());
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(SETTINGS_CHANGE_EVENT, onChange);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SETTINGS_CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  function setValue(key, value) {
    setSettings(updateSetting(key, value));
  }

  // Resolve farmer id from profile first, then any of the legacy
  // localStorage keys we know about. Empty → hide the section.
  const farmerId =
    (profile && (profile.farmerUuid || profile.farmer_uuid || profile.id)) ||
    safeReadLS('farroway_farmer_uuid') ||
    safeReadLS('farmerUuid') ||
    safeReadLS('currentFarmerId') ||
    '';

  async function handleCopy() {
    if (!farmerId) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(farmerId);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard denied — silent */ }
  }

  return (
    <main style={S.page} data-testid="settings-page">
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {tSafe(t, 'common.back', 'Back')}
        </button>
        <h1 style={S.h1}>{tSafe(t, 'settings.title', 'Settings')}</h1>

        {/* ─── A. Notifications ─────────────────────────────── */}
        <section style={S.card} data-testid="settings-notifications">
          <h2 style={S.h2}>{tSafe(t, 'settings.notifications', 'Notifications')}</h2>

          <SettingToggle
            label={tSafe(t, 'settings.daily', 'Daily reminder')}
            helper={tSafe(t, 'settings.dailyHelper', '')}
            value={settings.daily}
            onChange={(v) => setValue('daily', v)}
            testId="setting-daily"
          />
          <SettingToggle
            label={tSafe(t, 'settings.weather', 'Weather alerts')}
            helper={tSafe(t, 'settings.weatherHelper', '')}
            value={settings.weather}
            onChange={(v) => setValue('weather', v)}
            testId="setting-weather"
          />
          <SettingToggle
            label={tSafe(t, 'settings.risk', 'Risk alerts')}
            helper={tSafe(t, 'settings.riskHelper', '')}
            value={settings.risk}
            onChange={(v) => setValue('risk', v)}
            testId="setting-risk"
          />
          <SettingToggle
            label={tSafe(t, 'settings.missed', 'Missed task reminders')}
            helper={tSafe(t, 'settings.missedHelper', '')}
            value={settings.missed}
            onChange={(v) => setValue('missed', v)}
            testId="setting-missed"
            isLast
          />
        </section>

        {/* ─── B. Communication ─────────────────────────────── */}
        <section style={S.card} data-testid="settings-communication">
          <h2 style={S.h2}>{tSafe(t, 'settings.communication', 'Communication')}</h2>

          <SettingToggle
            label={tSafe(t, 'settings.email', 'Email')}
            helper={tSafe(t, 'settings.emailHelper', '')}
            value={settings.email}
            onChange={(v) => setValue('email', v)}
            testId="setting-email"
          />
          <SettingToggle
            label={tSafe(t, 'settings.sms', 'SMS')}
            helper={tSafe(t, 'settings.smsHelper', '')}
            value={settings.sms}
            onChange={(v) => setValue('sms', v)}
            testId="setting-sms"
          />

          <div style={{ ...S.row, ...S.rowLast }}>
            <div style={S.labelCol}>
              <div style={S.label}>
                {tSafe(t, 'settings.reminderTime', 'Reminder time')}
              </div>
              {tSafe(t, 'settings.reminderTimeHelper', '') && (
                <div style={S.helper}>
                  {tSafe(t, 'settings.reminderTimeHelper', '')}
                </div>
              )}
            </div>
            <input
              type="time"
              value={settings.reminderTime || '07:00'}
              onChange={(e) => setValue('reminderTime', e.target.value)}
              style={S.timeInput}
              data-testid="setting-reminder-time"
            />
          </div>
        </section>

        {/* ─── C. Farmer ID ─────────────────────────────────── */}
        {farmerId && (
          <section style={S.card} data-testid="settings-farmer-id">
            <h2 style={S.h2}>{tSafe(t, 'settings.farmerId', 'Farmer ID')}</h2>
            <div style={S.idRow}>
              <span style={S.idText}>{farmerId}</span>
              <button
                type="button"
                onClick={handleCopy}
                style={S.copyBtn}
                data-testid="setting-copy-farmer-id"
              >
                {copied
                  ? tSafe(t, 'farmerId.copied', tSafe(t, 'actions.copied', 'Copied'))
                  : tSafe(t, 'actions.copy', tSafe(t, 'common.copy', 'Copy'))}
              </button>
            </div>
          </section>
        )}

        {/* ─── D. Account actions (Logout + Reset) ──────────── */}
        <section style={S.card} data-testid="settings-account-actions">
          <h2 style={S.h2}>{tSafe(t, 'settings.account', 'Account')}</h2>

          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            style={S.actionBtn}
            data-testid="settings-logout"
          >
            <span style={S.actionIcon} aria-hidden="true">{'\u2192'}</span>
            <span style={S.actionLabel}>
              {tSafe(t, 'settings.logout', 'Logout')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setResetOpen(true)}
            style={S.dangerBtn}
            data-testid="settings-reset"
          >
            <span style={S.actionIcon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
            <span style={S.actionLabel}>
              {tSafe(t, 'settings.reset', 'Reset App')}
            </span>
          </button>
        </section>
      </div>

      <ConfirmModal
        open={logoutOpen}
        title={tSafe(t, 'settings.logout.confirmTitle',
          'Are you sure you want to logout?')}
        body={tSafe(t, 'settings.logout.confirmBody',
          'You can sign back in any time \u2014 your farm data stays on this device.')}
        confirmLabel={tSafe(t, 'settings.logout', 'Logout')}
        cancelLabel={tSafe(t, 'common.cancel', 'Cancel')}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          try { logout(navigate); } catch { /* swallow */ }
        }}
        testId="settings-logout-modal"
      />

      <ConfirmModal
        open={resetOpen}
        destructive
        title={tSafe(t, 'settings.reset.confirmTitle',
          'Reset Farroway on this device?')}
        body={tSafe(t, 'settings.reset.confirmBody',
          'This will remove all your data on this device. Continue?')}
        confirmLabel={tSafe(t, 'settings.reset', 'Reset App')}
        cancelLabel={tSafe(t, 'common.cancel', 'Cancel')}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          try { resetApp(navigate); } catch { /* swallow */ }
        }}
        testId="settings-reset-modal"
      />
    </main>
  );
}

function SettingToggle({ label, helper, value, onChange, testId, isLast }) {
  const checked = !!value;
  return (
    <div style={{ ...S.row, ...(isLast ? S.rowLast : null) }}>
      <div style={S.labelCol}>
        <div style={S.label}>{label}</div>
        {helper ? <div style={S.helper}>{helper}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        style={{ ...S.toggle, ...(checked ? S.toggleOn : S.toggleOff) }}
        data-testid={testId}
      >
        <span aria-hidden="true" style={S.toggleMark}>{checked ? '\u2713' : ''}</span>
      </button>
    </div>
  );
}

function safeReadLS(key) {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) || '';
  } catch { return ''; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem 0 6rem',
  },
  container: {
    maxWidth: '32rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.25rem 0',
    WebkitTapHighlightColor: 'transparent',
  },
  h1: {
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: 0,
    color: '#EAF2FF',
  },
  card: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  h2: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#E2E8F0',
    margin: '0 0 0.25rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.875rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  rowLast: { borderBottom: 0 },
  labelCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#F8FAFC',
  },
  helper: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.4,
    marginTop: '0.125rem',
  },
  toggle: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '1rem',
    fontWeight: 800,
    transition: 'background 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
  },
  toggleOn: {
    background: '#22C55E',
    color: '#fff',
    borderColor: 'rgba(34,197,94,0.6)',
  },
  toggleOff: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
  },
  toggleMark: { lineHeight: 1 },
  timeInput: {
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '0.625rem 0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    colorScheme: 'dark',
    outline: 'none',
    flexShrink: 0,
  },
  idRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0 0.25rem',
    flexWrap: 'wrap',
    wordBreak: 'break-all',
  },
  idText: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: '#9FB3C8',
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
  },
  copyBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '0.5rem 0.875rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#EAF2FF',
    background: 'rgba(255,255,255,0.05)',
    cursor: 'pointer',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.625rem',
    width: '100%',
    minHeight: '52px',
    marginTop: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
  },
  dangerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.625rem',
    width: '100%',
    minHeight: '52px',
    marginTop: '0.625rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(239,68,68,0.45)',
    background: 'rgba(239,68,68,0.10)',
    color: '#FCA5A5',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
  },
  actionIcon: {
    fontSize: '1.125rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  actionLabel: {
    flex: 1,
    minWidth: 0,
  },
};
