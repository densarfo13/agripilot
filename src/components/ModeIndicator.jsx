/**
 * ModeIndicator — small, unobtrusive badge showing current mode.
 *
 * Visible in farmer modes (basic/standard). Admin mode is implicit.
 * Tapping opens mode switcher inline.
 */
import { useState } from 'react';
import { useUserMode } from '../context/UserModeContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

export default function ModeIndicator() {
  const { mode, setMode, allowedModes, isFarmer } = useUserMode();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Only show for farmer modes with multiple options
  if (!isFarmer || allowedModes.length <= 1) return null;

  const modeLabel = mode === 'basic' ? t('mode.basic') : t('mode.standard');
  const modeIcon = mode === 'basic' ? '🔵' : '📝';

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={S.badge}
        data-testid="mode-indicator"
        aria-label={modeLabel}
      >
        <span style={S.badgeIcon}>{modeIcon}</span>
        <span style={S.badgeLabel}>{modeLabel}</span>
      </button>
    );
  }

  // Expanded: show mode switcher inline
  return (
    <div style={S.switcherWrap} data-testid="mode-indicator-expanded">
      {allowedModes.map((m) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setExpanded(false);
            }}
            style={{
              ...S.switchBtn,
              ...(isActive ? S.switchBtnActive : {}),
            }}
            data-testid={`mode-switch-${m}`}
          >
            <span>{m === 'basic' ? '🔵' : '📝'}</span>
            <span>{m === 'basic' ? t('mode.basic') : t('mode.standard')}</span>
          </button>
        );
      })}
    </div>
  );
}

const S = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  badgeIcon: {
    fontSize: '0.65rem',
  },
  badgeLabel: {
    letterSpacing: '0.02em',
  },
  switcherWrap: {
    display: 'flex',
    gap: '0.375rem',
    padding: '0.25rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  switchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.375rem 0.625rem',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
  switchBtnActive: {
    background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC',
  },
};
