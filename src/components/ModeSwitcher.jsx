/**
 * ModeSwitcher — lets farmers toggle between basic ↔ standard mode.
 *
 * Admin roles only see "advanced" (no toggle needed).
 * Farmers: basic ↔ standard with clear icon labels.
 * Compact: fits in settings or header area.
 */
import { useUserMode } from '../context/UserModeContext.jsx';
import { useTranslation } from '../i18n/index.js';

export default function ModeSwitcher() {
  const { mode, setMode, allowedModes } = useUserMode();
  const { t } = useTranslation();

  // No toggle needed if only one mode allowed
  if (allowedModes.length <= 1) return null;

  return (
    <div style={S.wrap} data-testid="mode-switcher">
      {allowedModes.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          style={{
            ...S.btn,
            ...(mode === m ? S.btnActive : {}),
          }}
          data-testid={`mode-btn-${m}`}
          aria-pressed={mode === m}
        >
          <span style={S.icon}>{m === 'basic' ? '🔵' : '📝'}</span>
          <span style={S.label}>
            {m === 'basic' ? t('mode.basic') : t('mode.standard')}
          </span>
        </button>
      ))}
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.25rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
  },
  btn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    minHeight: '40px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s',
  },
  btnActive: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#86EFAC',
  },
  icon: {
    fontSize: '0.9rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
  },
};
