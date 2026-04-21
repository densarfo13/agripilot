/**
 * downloadCsv.js — browser CSV download helper.
 *
 *   downloadCsv({ filename, csv }) → boolean
 *
 * v1 uses a plain <a download> link. Falls back silently (returns
 * false) on non-browser / locked-down environments. Does NOT throw.
 */

function safeName(name) {
  const base = String(name || 'farroway-report').replace(/[^a-z0-9_\-\.]/gi, '_');
  return /\.csv$/i.test(base) ? base : `${base}.csv`;
}

export function downloadCsv({ filename, csv } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!csv || typeof csv !== 'string') return false;
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = (window.URL || window.webkitURL).createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName(filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Slight delay so some browsers (Safari) actually fire download.
    setTimeout(() => {
      try { document.body.removeChild(a); } catch { /* ignore */ }
      try { (window.URL || window.webkitURL).revokeObjectURL(url); } catch { /* ignore */ }
    }, 100);
    return true;
  } catch { return false; }
}

export const _internal = Object.freeze({ safeName });
