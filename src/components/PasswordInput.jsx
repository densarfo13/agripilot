/**
 * PasswordInput — <input type="password"> with a show/hide toggle.
 *
 * Drop-in replacement anywhere the app currently renders an
 * <input type="password" />. The toggle state is local to each
 * instance (so two fields on one form — e.g. "New password" +
 * "Confirm" — reveal independently).
 *
 * Props:
 *   All standard <input> props pass through (value, onChange,
 *   onBlur, disabled, minLength, maxLength, required, autoComplete,
 *   placeholder, id, style, ...).
 *
 *   wrapperStyle — optional style overrides for the outer
 *     positioning wrapper (rarely needed).
 *   toggleAriaLabels — optional { show, hide } overrides so pages
 *     can pass translated strings; falls back to English.
 *   testIdPrefix — optional; when set, the toggle button gets
 *     `${testIdPrefix}-toggle` for Playwright/Vitest hooks.
 *   data-testid — forwarded to the input (preserves existing test
 *     contracts).
 *
 * The toggle is a real <button type="button">. It:
 *   • keeps the keyboard focus on the input (onMouseDown preventDefault)
 *   • carries aria-label "Show password" / "Hide password"
 *   • reaches via Tab so screen-reader + keyboard users can use it
 *   • never participates in form submission (type="button")
 *
 * Visuals are Farroway-dark: subtle eye glyph on the right of the
 * field, hit-target ≥ 40×40 for easy mobile tap, matches the
 * existing input border radius + right padding.
 */

import { forwardRef, useId, useState } from 'react';

const EYE_OPEN = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EYE_OFF = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.5 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10.5 7 10.5 7a17.6 17.6 0 0 1-3.2 3.9" />
    <path d="M6.3 7.9A17.6 17.6 0 0 0 1.5 13s4 7 10.5 7c1.9 0 3.5-.5 4.9-1.2" />
    <path d="M9.5 9.5a3 3 0 0 0 4.2 4.2" />
  </svg>
);

const PasswordInput = forwardRef(function PasswordInput({
  style,
  wrapperStyle,
  toggleAriaLabels,
  testIdPrefix,
  ...inputProps
}, ref) {
  const [revealed, setRevealed] = useState(false);
  const reactId = useId();
  const labels = {
    show: (toggleAriaLabels && toggleAriaLabels.show) || 'Show password',
    hide: (toggleAriaLabels && toggleAriaLabels.hide) || 'Hide password',
  };
  const toggleId = `${reactId}-pw-toggle`;

  // Preserve caller's padding while reserving room for the button.
  const composedStyle = {
    ...(style || {}),
    paddingRight: '2.75rem',
    boxSizing: 'border-box',
  };

  // preventDefault on mousedown keeps the input focused through the
  // click so the user can toggle mid-typing without losing caret.
  const keepFocus = (e) => { e.preventDefault(); };

  const onToggle = () => setRevealed((v) => !v);
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div style={{ ...S.wrapper, ...(wrapperStyle || {}) }}>
      <input
        ref={ref}
        {...inputProps}
        type={revealed ? 'text' : 'password'}
        style={composedStyle}
      />
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={keepFocus}
        onKeyDown={onKeyDown}
        aria-label={revealed ? labels.hide : labels.show}
        aria-pressed={revealed}
        aria-controls={inputProps.id || toggleId}
        tabIndex={0}
        data-testid={testIdPrefix ? `${testIdPrefix}-toggle` : 'password-toggle'}
        style={S.toggleBtn}
      >
        {revealed ? EYE_OFF : EYE_OPEN}
      </button>
    </div>
  );
});

export default PasswordInput;

const S = {
  wrapper: {
    position: 'relative',
    display: 'block',
    width: '100%',
  },
  toggleBtn: {
    position: 'absolute',
    top: '50%',
    right: '0.5rem',
    transform: 'translateY(-50%)',
    width: '2.25rem',
    height: '2.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: 0,
    outlineOffset: '2px',
  },
};
