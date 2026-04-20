/**
 * SizeUnitDropdown — the spec's §12 reusable select.
 *
 * Controlled component: caller owns `unit` state and the setter.
 * Renders localized labels when a `t` function is provided;
 * otherwise falls back to English.
 */

import { SIZE_UNITS } from '../../core/farm/unified.js';

export default function SizeUnitDropdown({
  unit, setUnit, t = null,
  className = '', style = null, id, 'aria-label': ariaLabel,
}) {
  return (
    <select
      id={id}
      value={unit || SIZE_UNITS[0].value}
      onChange={(e) => typeof setUnit === 'function' && setUnit(e.target.value)}
      className={className}
      style={style || undefined}
      aria-label={ariaLabel || 'size unit'}
      data-testid="size-unit-dropdown"
    >
      {SIZE_UNITS.map((u) => {
        const label = typeof t === 'function' && u.labelKey
          ? (t(u.labelKey) && t(u.labelKey) !== u.labelKey ? t(u.labelKey) : u.label)
          : u.label;
        return (
          <option key={u.value} value={u.value}>{label}</option>
        );
      })}
    </select>
  );
}

export { SIZE_UNITS };
