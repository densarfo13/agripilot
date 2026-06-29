import React, { useEffect, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { searchLocations } from '../../utils/geolocation.js';

/**
 * LocationSearch — instant town / postal-code search for the location fallback.
 *
 * Type "Fred" → suggestions (Frederick, Frederick County, Maryland …) appear after a short
 * debounce. Selecting one calls onSelect(result) with { label, lat, lng, country, region,
 * locality }. Forward-geocode runs over the existing OSM Nominatim integration
 * (searchLocations) — no new service. Best-effort: a failed/empty search just shows nothing.
 *
 * Props:
 *   onSelect(result) — required; fired when the farmer taps a suggestion.
 *   placeholder, autoFocus, testId
 */
export default function LocationSearch({ onSelect, placeholder, autoFocus, testId = 'location-search' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults([]); setLoading(false); return undefined; }
    setLoading(true);
    // Debounce ~350ms — respects Nominatim's rate limit + avoids a request per keystroke.
    const t = setTimeout(() => {
      if (abortRef.current) { try { abortRef.current.abort(); } catch { /* ignore */ } }
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      abortRef.current = ctrl;
      searchLocations(q, { signal: ctrl ? ctrl.signal : undefined })
        .then((rows) => { setResults(rows); })
        .catch(() => { setResults([]); })
        .finally(() => { setLoading(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={S.wrap} data-testid={testId}>
      <input
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || tSafe('location.search.placeholder', 'Search your town or ZIP code')}
        aria-label={tSafe('location.search.aria', 'Search your town or postal code')}
        style={S.input}
        data-testid={`${testId}-input`}
        inputMode="search"
        autoComplete="off"
      />
      {loading && query.trim().length >= 3 ? (
        <div style={S.hint}>{tSafe('location.search.searching', 'Searching…')}</div>
      ) : null}
      {results.length > 0 ? (
        <ul style={S.list} role="listbox" aria-label={tSafe('location.search.results', 'Location suggestions')}>
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => { try { onSelect && onSelect(r); } catch { /* never block */ } }}
                style={S.option}
                data-testid={`${testId}-option`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const S = {
  wrap: { width: '100%', boxSizing: 'border-box' },
  input: {
    width: '100%', minHeight: 48, padding: '0.6rem 0.8rem', boxSizing: 'border-box',
    border: '1px solid rgba(0,0,0,0.18)', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  hint: { fontSize: '0.8rem', color: '#71717A', marginTop: '0.4rem' },
  list: { listStyle: 'none', margin: '0.4rem 0 0', padding: 0, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, overflow: 'hidden' },
  option: {
    display: 'block', width: '100%', textAlign: 'left', minHeight: 48,
    padding: '0.6rem 0.8rem', background: '#fff', border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '0.9rem', color: '#1f2937',
    cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
  },
};
