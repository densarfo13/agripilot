/**
 * LowLiteracyToggle — small "Simple / Icon mode" switch for farmer
 * surfaces. Persists the flag via useLowLiteracyMode (localStorage
 * key `farroway:lowLiteracyMode`) and broadcasts a change event the
 * IconActionCard listens for.
 *
 * Visible text is fully translated via tStrict; the icon (🪶 / 📖)
 * is the primary affordance for farmers who can't read the label.
 */

import { useCallback } from 'react';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import useLowLiteracyMode from '../hooks/useLowLiteracyMode.js';

export default function LowLiteracyToggle({ className = '' }) {
  // Subscribes to language change so the label updates live.
  useTranslation();
  const { enabled, toggle } = useLowLiteracyMode();

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    toggle();
  }, [toggle]);

  const label = enabled
    ? tStrict('farmerActions.standardMode', 'Standard')
    : tStrict('farmerActions.simpleMode', 'Simple');

  const aria = enabled
    ? tStrict('farmerActions.switchToStandard', label)
    : tStrict('farmerActions.switchToSimple', label);

  const cls = [
    'low-literacy-toggle',
    enabled ? 'low-literacy-toggle--on' : 'low-literacy-toggle--off',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      aria-label={aria}
      aria-pressed={enabled}
    >
      <span aria-hidden="true">{enabled ? '🪶' : '📖'}</span>
      <span className="low-literacy-toggle__label">{label}</span>
    </button>
  );
}
