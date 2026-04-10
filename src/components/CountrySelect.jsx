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
  className,
  searchClassName,   // class for the search input; falls back to className when omitted
  inputStyle,
  selectStyle,
  wrapperStyle,
  includeEmpty = false,
  emptyLabel = 'Not specified',
  showDialCode = false,
  required,
  disabled,
  name,
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
    fontSize: '0.9rem',
    ...inputStyle,
  };

  return (
    <div style={wrapperStyle}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search country..."
        className={searchClassName ?? className}
        style={baseInputStyle}
        disabled={disabled}
        autoComplete="off"
        aria-label="Search country"
      />
      <select
        name={name}
        className={className}
        style={{ minHeight: '44px', fontSize: '0.9rem', ...selectStyle }}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
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
