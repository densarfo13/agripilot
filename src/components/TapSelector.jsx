import React from 'react';

/**
 * TapSelector — tap-first pill/card selector for low-literacy-friendly input.
 *
 * Replaces native <select> elements with large, tappable pill buttons.
 * Designed for mobile-first usage with 44px minimum touch targets.
 *
 * Props:
 *   options       {Array<{value, label, icon?, color?}>}  — selectable options
 *   value         {string}           — currently selected value
 *   onChange      {fn}               — receives new value string
 *   label?        {string}           — optional label above the selector
 *   required?     {bool}             — show required indicator
 *   columns?      {number}           — grid columns (default: auto-fit)
 *   compact?      {bool}             — smaller pills for inline usage
 *   disabled?     {bool}
 *   style?        {object}           — wrapper style override
 */
export default function TapSelector({
  options,
  value,
  onChange,
  label,
  required = false,
  columns,
  compact = false,
  disabled = false,
  style,
}) {
  const gridStyle = columns
    ? { gridTemplateColumns: `repeat(${columns}, 1fr)` }
    : { gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? '80px' : '100px'}, 1fr))` };

  return (
    <div style={style}>
      {label && (
        <label style={S.label}>
          {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        </label>
      )}
      <div style={{ ...S.grid, ...gridStyle }}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const accentColor = opt.color || '#22C55E';
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              style={{
                ...S.pill,
                ...(compact ? S.pillCompact : {}),
                borderColor: isSelected ? accentColor : '#243041',
                background: isSelected ? accentColor + '18' : '#1E293B',
                color: isSelected ? accentColor : '#FFFFFF',
                fontWeight: isSelected ? 600 : 400,
                opacity: disabled ? 0.5 : 1,
              }}
              aria-pressed={isSelected}
              aria-label={opt.label}
            >
              {opt.icon && <span style={S.icon}>{opt.icon}</span>}
              <span>{opt.label}</span>
              {isSelected && <span style={{ ...S.check, color: accentColor }}>&#10003;</span>}
            </button>
          );
        })}
      </div>
      {/* Hidden input for form validation when required */}
      {required && (
        <input
          type="text"
          value={value || ''}
          required
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
          onChange={() => {}}
        />
      )}
    </div>
  );
}

const S = {
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#A1A1AA',
    marginBottom: '0.4rem',
  },
  grid: {
    display: 'grid',
    gap: '0.4rem',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.6rem 0.75rem',
    minHeight: '44px',
    border: '2px solid #243041',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    lineHeight: 1.3,
  },
  pillCompact: {
    padding: '0.4rem 0.6rem',
    fontSize: '0.82rem',
    minHeight: '40px',
    borderRadius: '6px',
  },
  icon: {
    fontSize: '1rem',
    lineHeight: 1,
  },
  check: {
    fontSize: '0.75rem',
    fontWeight: 700,
    marginLeft: '0.15rem',
  },
};
