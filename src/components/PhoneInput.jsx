import React from 'react';
import { getDialCode } from '../utils/countries.js';

/**
 * PhoneInput — country-aware phone field with a dial-code prefix badge.
 *
 * Usage pattern:
 *   <PhoneInput
 *     value={form.phone}
 *     onChange={set('phone')}
 *     countryCode={form.countryCode}
 *     className="form-input"
 *     required
 *   />
 *
 * Props:
 *   value       {string}  full phone value managed by parent (e.g. "+254712345678")
 *   onChange    {fn}      standard React onChange — receives synthetic event {target:{value}}
 *   countryCode {string}  ISO-2 code — drives the displayed dial code badge (e.g. "KE" → "+254")
 *   className   {string}  CSS class applied to the <input> element
 *   style       {object}  inline style applied to the <input> element
 *   required    {bool}
 *   disabled    {bool}
 *   placeholder {string}  defaults to the country dial code + example digits
 *
 * Behaviour:
 *   - The dial code badge is informational — it updates when countryCode changes
 *     but does NOT auto-transform the stored value (too risky; user edits explicitly).
 *   - On blur: if the entered value has no "+" prefix, the component normalizes it
 *     by stripping leading zeros and prepending the country's dial code, then fires
 *     onChange with the corrected value.
 *   - While typing: value passes through unchanged so the user can freely edit.
 */
export default function PhoneInput({
  value = '',
  onChange,
  countryCode = '',
  className,
  style,
  required,
  disabled,
  placeholder,
}) {
  const dialCode = getDialCode(countryCode); // e.g. "+254" or "" if unknown

  /** Normalize on blur: prepend dial code if the number has no + prefix. */
  const handleBlur = () => {
    if (!value) return;
    const normalized = normalizePhone(value, dialCode);
    if (normalized !== value) {
      onChange({ target: { value: normalized } });
    }
  };

  const defaultPlaceholder = dialCode
    ? `${dialCode} 712 345 678`
    : 'Phone number';

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}>
      {dialCode && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 0.65rem',
            background: '#1E293B',
            border: '1px solid #243041',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#FFFFFF',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {dialCode}
        </span>
      )}
      <input
        type="tel"
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        className={className}
        style={{ ...style, flex: 1, minWidth: 0 }}
        required={required}
        disabled={disabled}
        placeholder={placeholder ?? defaultPlaceholder}
        autoComplete="tel"
      />
    </div>
  );
}

/**
 * Normalize a raw phone string using the given dial code.
 *
 * Rules (applied in order):
 *   1. Strip spaces, dashes, dots, parentheses.
 *   2. If already starts with "+", return as-is (already E.164-like).
 *   3. If dialCode is unknown, return cleaned string unchanged.
 *   4. If starts with the numeric dial code (e.g. "254..."), prepend "+".
 *   5. Strip a single leading "0" (national-format convention), then prepend dialCode.
 *
 * Exported for testing.
 */
export function normalizePhone(phone, dialCode) {
  if (!phone) return phone;
  const clean = phone.trim().replace(/[\s\-().]/g, '');
  if (!clean) return clean;
  if (clean.startsWith('+')) return clean;            // already has + prefix — leave alone
  if (!dialCode) return clean;                         // no dial code known — leave alone
  const digits = dialCode.replace('+', '');            // e.g. "254"
  if (clean.startsWith(digits)) return '+' + clean;    // "254712..." → "+254712..."
  const stripped = clean.startsWith('0') ? clean.slice(1) : clean; // strip leading 0
  return dialCode + stripped;                           // prepend "+254" etc.
}
