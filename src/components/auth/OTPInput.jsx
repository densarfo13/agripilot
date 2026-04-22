/**
 * OTPInput — numeric verification-code input.
 *
 * Renders a single wide input styled for OTP entry, but also
 * handles:
 *   • paste of a full code (digits pulled out, whitespace stripped)
 *   • "one-time-code" autocomplete hint so iOS keyboards auto-fill
 *     from the incoming SMS
 *   • numeric keyboard on mobile (inputMode="numeric")
 *   • configurable length (default 6) — paste gets truncated
 *   • onComplete callback fires once when the code reaches length
 *
 * Props:
 *   value          — controlled value (digits only)
 *   onChange(str)  — called with the cleaned digits-only value
 *   onComplete(str)— optional; called once when value length ===
 *                    maxLength (fires exactly once per completion)
 *   length         — expected code length (default 6)
 *   placeholder    — visual placeholder (default '0'.repeat(length))
 *   disabled, style, autoFocus — standard passthroughs
 *   testId         — data-testid for Playwright/Vitest
 *   ariaLabel      — accessible label for screen readers
 *
 * Keyboard accessible by default (it's a real <input>).
 */

import { forwardRef, useEffect, useRef } from 'react';

const OTPInput = forwardRef(function OTPInput({
  value = '',
  onChange,
  onComplete = null,
  length = 6,
  placeholder = null,
  disabled = false,
  style = null,
  autoFocus = false,
  testId = null,
  ariaLabel = 'Verification code',
  ...rest
}, ref) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!onComplete) return;
    const cleaned = String(value || '').replace(/\D/g, '');
    if (cleaned.length === length && !firedRef.current) {
      firedRef.current = true;
      onComplete(cleaned);
    } else if (cleaned.length < length) {
      firedRef.current = false;
    }
  }, [value, length, onComplete]);

  function clean(raw) {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, length);
    return digits;
  }

  function handleChange(e) {
    const cleaned = clean(e.target.value);
    if (typeof onChange === 'function') onChange(cleaned);
  }

  function handlePaste(e) {
    const pasted = (e.clipboardData || window.clipboardData || { getData: () => '' }).getData('text');
    if (!pasted) return;
    e.preventDefault();
    const cleaned = clean(pasted);
    if (typeof onChange === 'function') onChange(cleaned);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={length + 2}   // forgive extra characters; clean on change
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder != null ? placeholder : '0'.repeat(length)}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      data-testid={testId || 'otp-input'}
      style={{ ...S.input, ...(style || {}) }}
      {...rest}
    />
  );
});

export default OTPInput;

const S = {
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    fontSize: '1.375rem',
    letterSpacing: '0.4em',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#111827',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
