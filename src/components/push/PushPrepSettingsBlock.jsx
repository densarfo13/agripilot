/**
 * PushPrepSettingsBlock — push notification preparation UI.
 *
 * Mounted inside the Settings page when FEATURE_PUSH_PREP is on.
 * Self-suppresses (returns null) when the flag is off or the browser
 * does not support the Notification API.
 *
 * Controls (spec §3):
 *   • "Daily task reminders" toggle — persisted in pushPrep prefs
 *   • "Buyer request alerts" toggle — persisted in pushPrep prefs
 *   • "Enable notifications" button — fires browser permission prompt
 *     on direct user tap ONLY. Never prompts on mount.
 *
 * Permission states handled:
 *   default     → "Enable notifications" button visible
 *   granted     → green "Notifications are enabled." confirmation
 *   denied      → "Notifications are off. You can enable them later in settings."
 *   unsupported → block is hidden (isSupported() guard in outer component)
 *
 * Safe rules:
 *   • NEVER prompts on mount — permission request is button-tap only.
 *   • NEVER throws — try/catch around every pref write and state update.
 *   • NEVER blocks render — all state derived from synchronous LS reads.
 *   • React #300 safe — inner component PushPrepInner calls all hooks
 *     unconditionally; outer shell does early returns with no hooks.
 */

import { useState, useCallback } from 'react';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import {
  getPrefs,
  setPrefs,
  getPermissionState,
  requestNotificationPermission,
  isSupported,
} from '../../notifications/pushPrep.js';
import { tSafe } from '../../i18n/tSafe.js';

/**
 * PushPrepSettingsBlock — outer shell.
 *
 * Has NO hooks — only early-return guards. Renders PushPrepInner
 * when the environment supports push prep so that PushPrepInner's
 * hooks are always called in the same order (rules-of-hooks safe).
 */
export default function PushPrepSettingsBlock() {
  if (!isFeatureEnabled('FEATURE_PUSH_PREP')) return null;
  // Hide entirely when Notification API is absent (old browser / SSR).
  if (!isSupported()) return null;
  return <PushPrepInner />;
}

/**
 * PushPrepInner — all hooks live here, called unconditionally.
 */
function PushPrepInner() {
  const [prefs,      setPrefsState] = useState(() => getPrefs());
  const [permission, setPermission] = useState(() => getPermissionState());
  const [requesting, setRequesting] = useState(false);

  function updatePref(key, value) {
    try {
      const next = setPrefs({ [key]: value });
      setPrefsState(next);
    } catch { /* swallow */ }
  }

  // handleEnableNotifications — MUST be wired to a button onClick only.
  // useCallback keeps the reference stable across re-renders.
  const handleEnableNotifications = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      setPrefsState(getPrefs());
    } catch { /* swallow */ } finally {
      setRequesting(false);
    }
  }, [requesting]);

  // "Buyer request alerts" is the last preference row only when
  // the permission area is absent (granted / denied already decided).
  const prefsAreLastRow = permission !== 'default';

  return (
    <section style={S.card} data-testid="push-prep-settings-block">
      <h2 style={S.h2}>
        {tSafe('pushPrep.title', 'Push Notifications')}
      </h2>

      {/* Daily task reminders */}
      <PushToggle
        label={tSafe('pushPrep.dailyTask', 'Daily task reminders')}
        helper={tSafe('pushPrep.dailyTaskHelper',
          "Get a nudge when today's tasks are ready.")}
        value={prefs.dailyTaskReminder}
        onChange={(v) => updatePref('dailyTaskReminder', v)}
        testId="push-pref-daily-task"
      />

      {/* Buyer request alerts */}
      <PushToggle
        label={tSafe('pushPrep.buyerAlerts', 'Buyer request alerts')}
        helper={tSafe('pushPrep.buyerAlertsHelper',
          'Know when a buyer is interested in your listing.')}
        value={prefs.buyerRequestAlerts}
        onChange={(v) => updatePref('buyerRequestAlerts', v)}
        testId="push-pref-buyer-alerts"
        isLast={prefsAreLastRow}
      />

      {/* ── Permission prompt (default state) ────────────────── */}
      {permission === 'default' && (
        <div style={{ ...S.row, ...S.rowLast }}>
          <div style={S.labelCol}>
            <div style={S.label}>
              {tSafe('pushPrep.enable', 'Enable notifications')}
            </div>
            <div style={S.helper}>
              {tSafe('pushPrep.enableHelper',
                'Allow Farroway to send you reminders.')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={requesting}
            style={requesting ? S.enableBtnBusy : S.enableBtn}
            data-testid="push-enable-btn"
          >
            {requesting
              ? tSafe('pushPrep.enabling', '…')
              : tSafe('pushPrep.enableAction', 'Enable')}
          </button>
        </div>
      )}

      {/* ── Denied state ──────────────────────────────────────── */}
      {permission === 'denied' && (
        <div style={S.deniedBanner} data-testid="push-denied-banner">
          <span style={S.bannerIcon} aria-hidden="true">🔕</span>
          <span style={S.deniedText}>
            {tSafe('pushPrep.denied',
              'Notifications are off. You can enable them later in settings.')}
          </span>
        </div>
      )}

      {/* ── Granted state ─────────────────────────────────────── */}
      {permission === 'granted' && (
        <div style={S.grantedBanner} data-testid="push-granted-banner">
          <span style={S.bannerIcon} aria-hidden="true">✅</span>
          <span style={S.grantedText}>
            {tSafe('pushPrep.granted', 'Notifications are enabled.')}
          </span>
        </div>
      )}
    </section>
  );
}

/** PushToggle — inline toggle row matching Settings.jsx's SettingToggle style. */
function PushToggle({ label, helper, value, onChange, testId, isLast }) {
  const checked = !!value;
  return (
    <div style={{ ...S.row, ...(isLast ? S.rowLast : {}) }}>
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

// ─── Styles (mirrors Settings.jsx card styling for visual consistency) ─────
const S = {
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
  enableBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    minHeight: '40px',
    WebkitTapHighlightColor: 'transparent',
  },
  enableBtnBusy: {
    padding: '0.5rem 1rem',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(34,197,94,0.3)',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'default',
    flexShrink: 0,
    minHeight: '40px',
  },
  deniedBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.75rem 0 0.25rem',
  },
  grantedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 0 0.25rem',
  },
  bannerIcon: { fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 },
  deniedText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  grantedText: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
    lineHeight: 1.5,
  },
};
