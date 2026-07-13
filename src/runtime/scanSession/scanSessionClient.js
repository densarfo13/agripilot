/**
 * scanSessionClient.js — RUNTIME-layer client for the guided multi-view scan
 * session API (PR-C). Self-contained fetch; never throws; returns
 * { ok, status, data } so the UI can render server-owned states (including
 * 409/429). The SERVER is the source of truth — this client never derives
 * session state, the next view, or allowed actions. No image bytes are logged.
 */

const SESSION_TIMEOUT_MS = 15000;

async function _req(method, path, body) {
  if (typeof fetch !== 'function') return { ok: false, status: 0, data: null };
  let ctrl = null, timer = null;
  try { ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null; } catch { ctrl = null; }
  try {
    if (ctrl) timer = setTimeout(() => { try { ctrl.abort(); } catch { /* ignore */ } }, SESSION_TIMEOUT_MS);
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    let data = null; try { data = await res.json(); } catch { data = null; }
    return { ok: !!(res && res.ok), status: res ? res.status : 0, data };
  } catch { if (timer) clearTimeout(timer); return { ok: false, status: 0, data: null }; }
}

const _id = (s) => encodeURIComponent(String(s || '').trim());

export const createScanSession   = (body)     => _req('POST', '/api/scan/sessions', body || {});
export const addScanSessionPhoto = (id, body) => _req('POST', '/api/scan/sessions/' + _id(id) + '/photos', body || {});
export const getScanSession      = (id)       => _req('GET',  '/api/scan/sessions/' + _id(id));
export const completeScanSession = (id)       => _req('POST', '/api/scan/sessions/' + _id(id) + '/complete');
export const escalateScanSession = (id)       => _req('POST', '/api/scan/sessions/' + _id(id) + '/escalate');

// §12 client analytics — sessionId + state ONLY. Never image data / URLs.
export function emitScanUiEvent(event, sessionId, state) {
  try {
    const rec = {
      event: String(event || ''),
      sessionId: sessionId ? String(sessionId) : null,
      state: state ? String(state) : null,
    };
    if (typeof window !== 'undefined') {
      const buf = (window.__scanUiEvents = window.__scanUiEvents || []);
      buf.push(rec);
      if (buf.length > 200) buf.shift();
    }
    try { console.log('[scan.ui] ' + rec.event + (rec.sessionId ? ' session=' + rec.sessionId : '') + (rec.state ? ' state=' + rec.state : '')); } catch { /* ignore */ }
  } catch { /* analytics must never break the UI */ }
}

// Session recovery (§1/§11/§19) — persist only the id, so a refresh can re-fetch
// the authoritative state from the server (never reconstruct state locally).
const RECOVERY_KEY = 'ff_scan_session_id';
export function rememberSessionId(id) {
  try { if (typeof sessionStorage !== 'undefined' && id) sessionStorage.setItem(RECOVERY_KEY, String(id)); } catch { /* ignore */ }
}
export function recallSessionId() {
  try { return (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem(RECOVERY_KEY) : null; } catch { return null; }
}
export function forgetSessionId() {
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
}

export default {
  createScanSession, addScanSessionPhoto, getScanSession, completeScanSession, escalateScanSession,
  emitScanUiEvent, rememberSessionId, recallSessionId, forgetSessionId,
};
