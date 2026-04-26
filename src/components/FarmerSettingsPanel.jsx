/**
 * FarmerSettingsPanel — compact settings for farmer modes.
 *
 * Shows:
 *   - Mode switcher (basic ↔ standard)
 *   - Voice guidance toggle (on/off)
 *
 * Designed for inline use on settings or bottom of home screen.
 * Low-literacy friendly: icon + short label, no complex forms.
 */
import { useUserMode } from '../context/UserModeContext.jsx';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
// Strict no-leak alias — see useStrictTranslation.js.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import NotificationSettingsCard from './NotificationSettingsCard.jsx';

export default function FarmerSettingsPanel() {
  const { mode, setMode, allowedModes, isFarmer } = useUserMode();
  const { autoVoice, setAutoVoice } = useAppPrefs();
  const { t } = useTranslation();

  if (!isFarmer) return null;

  return (
    <div style={S.panel} data-testid="farmer-settings">
      {/* ─── Mode switch ───────────────────── */}
      {allowedModes.length > 1 && (
        <div style={S.row}>
          <span style={S.rowLabel}>{t('settings.viewMode')}</span>
          <div style={S.toggleWrap}>
            {allowedModes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  ...S.toggleBtn,
                  ...(mode === m ? S.toggleActive : {}),
                }}
                data-testid={`settings-mode-${m}`}
              >
                {m === 'basic' ? '🔵' : '📝'}
                {' '}
                {m === 'basic' ? t('mode.basic') : t('mode.standard')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Voice toggle ──────────────────── */}
      <div style={S.row}>
        <span style={S.rowLabel}>{t('settings.voiceGuide')}</span>
        <button
          onClick={() => setAutoVoice(!autoVoice)}
          style={{
            ...S.voiceBtn,
            ...(autoVoice ? S.voiceBtnOn : {}),
          }}
          data-testid="settings-voice-toggle"
          aria-pressed={autoVoice}
        >
          {autoVoice ? '🔊' : '🔇'}
          {' '}
          {autoVoice ? t('settings.voiceOn') : t('settings.voiceOff')}
        </button>
      </div>

      {/* ─── Notification preferences ─────── */}
      <NotificationSettingsCard />
    </div>
  );
}

const S = {
  panel: {
    borderRadius: '14px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  rowLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    flexShrink: 0,
  },
  toggleWrap: {
    display: 'flex',
    gap: '0.375rem',
    padding: '0.125rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.625rem',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s',
  },
  toggleActive: {
    background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC',
  },
  voiceBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s',
  },
  voiceBtnOn: {
    borderColor: 'rgba(34,197,94,0.3)',
    background: 'rgba(34,197,94,0.1)',
    color: '#86EFAC',
  },
};
