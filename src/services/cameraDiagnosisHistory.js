/**
 * cameraDiagnosisHistory — last 5 scans in localStorage (spec §7).
 *
 * Entry: { id, category, titleKey, timestamp, thumbDataUrl? }
 * Thumbnails are stored only when the operator opts in — raw photos
 * never land in localStorage at full size.
 */

const KEY = 'farroway:camera_diagnosis_history';
const MAX = 5;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); }
  catch { /* quota — drop silently */ }
}

export function addScanEntry({ category, titleKey, thumbDataUrl, taskAdded = false }) {
  const all = read();
  all.push({
    id: `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    titleKey,
    timestamp: Date.now(),
    thumbDataUrl: thumbDataUrl || null,
    taskAdded,
  });
  write(all);
}

export function getScanHistory() {
  return [...read()].sort((a, b) => b.timestamp - a.timestamp);
}

export function clearScanHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
