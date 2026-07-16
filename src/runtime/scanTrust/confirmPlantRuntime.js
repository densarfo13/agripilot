/**
 * confirmPlantRuntime.js — RUNTIME-layer wrapper for the provisional
 * plant-confirmation call. Lives in runtime/ (not services/) so the UI can
 * import it directly without crossing the ui→service boundary (same layer as
 * scanGuidanceResolver). Self-contained fetch; never throws; returns null on
 * any failure so the card can fall back gracefully.
 *
 *   const out = await confirmScanPlant(scanId, taxonId);
 *   // → { state, confirmedPlant, health, recommendationLevel } | null
 */

const CONFIRM_TIMEOUT_MS = 8000;

export async function confirmScanPlant(scanId, candidateTaxonId) {
  const id = String(scanId || '').trim();
  const taxon = String(candidateTaxonId || '').trim();
  if (!id || !taxon) return null;
  if (typeof fetch !== 'function') return null;

  let controller = null;
  let timer = null;
  try { controller = typeof AbortController !== 'undefined' ? new AbortController() : null; }
  catch { controller = null; }
  try {
    if (controller) timer = setTimeout(() => { try { controller.abort(); } catch { /* ignore */ } }, CONFIRM_TIMEOUT_MS);
    const res = await fetch('/api/scan/' + encodeURIComponent(id) + '/confirm-plant', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ candidateTaxonId: taxon, confirmationSource: 'farmer' }),
      credentials: 'include',
      signal:  controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    if (timer) clearTimeout(timer);
    return null;
  }
}

// Scan Intelligence §4 — "none of these": records farmer_rejected_species on
// the server. Same self-contained fetch contract; null on any failure.
export async function rejectScanPlant(scanId) {
  const id = String(scanId || '').trim();
  if (!id || typeof fetch !== 'function') return null;
  let controller = null, timer = null;
  try { controller = typeof AbortController !== 'undefined' ? new AbortController() : null; }
  catch { controller = null; }
  try {
    if (controller) timer = setTimeout(() => { try { controller.abort(); } catch { /* ignore */ } }, CONFIRM_TIMEOUT_MS);
    const res = await fetch('/api/scan/' + encodeURIComponent(id) + '/confirm-plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reject: true }),
      credentials: 'include',
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    if (timer) clearTimeout(timer);
    return null;
  }
}

export default confirmScanPlant;
