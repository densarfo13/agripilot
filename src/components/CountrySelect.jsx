import React, { useState, useMemo } from 'react';
import COUNTRIES from '../utils/countries.js';

/**
 * CountrySelect — searchable, full-country selector.
 *
 * Props:
 *   value            {string}  ISO-2 code or '' for no selection
 *   onChange         {fn}      receives a synthetic-event-like object: { target: { value: iso2 } }
 *   className        {string}  CSS class applied to the <select> element (e.g. "form-select")
 *   searchClassName  {string}  CSS class applied to the search <input> (defaults to className)
 *   inputStyle       {object}  extra inline styles for the search input element
 *   selectStyle      {object}  extra inline styles for the select element
 *   wrapperStyle     {object}  inline styles for the outer wrapper div
 *   includeEmpty     {bool}    prepend an empty "not specified" option  (default: false)
 *   emptyLabel       {string}  label text for the empty option           (default: "Not specified")
 *   showDialCode     {bool}    append dial code in option text           (default: false)
 *   required         {bool}
 *   disabled         {bool}
 *   name             {string}
 */
export default function CountrySelect({
  value = '',
  onChange,
  className = 'form-select',   // default so every caller picks up the
                               // dark-theme option rules in index.css
                               // (fixes Windows-Chromium white-on-white)
  searchClassName,             // class for the search input; falls back to
                               // 'form-input' when omitted
  inputStyle,
  selectStyle,
  wrapperStyle,
  includeEmpty = false,
  emptyLabel = 'Not specified',
  showDialCode = false,
  required,
  disabled,
  name,
  // F21 follow-up: callers can now pass `id` so the parent
  // <label htmlFor> resolves correctly. Forwarded to the
  // <select> element. The internal search input gets a
  // derived `${id}-search` id when id is provided, so both
  // controls satisfy the DevTools a11y "form field needs id
  // or name" check without colliding with each other.
  id,
}) {
  const [search, setSearch] = useState('');

  // Compute filtered list from search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().startsWith(q) ||
        c.dialCode.replace('+', '').startsWith(q.replace('+', ''))
    );
  }, [search]);

  // Always keep the currently selected country visible at the top when filtered out
  const options = useMemo(() => {
    if (!value || !search.trim()) return filtered;
    const inList = filtered.some((c) => c.iso2 === value);
    if (inList) return filtered;
    const selected = COUNTRIES.find((c) => c.iso2 === value);
    return selected ? [selected, ...filtered] : filtered;
  }, [filtered, value, search]);

  const baseInputStyle = {
    marginBottom: '0.3rem',
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '44px',
    fontSize: '16px',
    ...inputStyle,
  };

  return (
    <div style={wrapperStyle}>
      <input
        type="text"
        id={id ? `${id}-search` : undefined}
        name={id ? `${id}-search` : undefined}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search country…"
        /* Default the search input to `form-input` so it picks up the
           placeholder + focus-ring rules from index.css. Callers may
           still override via searchClassName for legacy screens. */
        className={searchClassName ?? 'form-input'}
        style={baseInputStyle}
        disabled={disabled}
        autoComplete="off"
        aria-label="Search country"
      />
      <select
        id={id}
        name={name || (id ? id : undefined)}
        aria-label="Country"
        className={className}
        style={{ minHeight: '48px', fontSize: '16px', padding: '0.5rem', ...selectStyle }}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        data-testid="country-select-dropdown"
      >
        <option value="">— Tap to choose country —</option>
        {includeEmpty && <option value="">{emptyLabel}</option>}
        {options.map((c) => (
          <option key={c.iso2} value={c.iso2}>
            {c.name}
            {showDialCode ? ` (${c.dialCode})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
