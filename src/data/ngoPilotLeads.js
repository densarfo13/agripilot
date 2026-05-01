/**
 * ngoPilotLeads.js — local-first pilot-lead capture for the
 * Funding Hub's "Start a pilot program" form.
 *
 * Storage
 * ───────
 *   localStorage[`farroway_ngo_pilot_leads`] = JSON.stringify(leads[])
 *
 * Each lead carries `id` + `createdAt` so the admin tile can
 * surface counts and the consumer can show a confirmation
 * immediately on submit.
 *
 * Future migration
 *   When `/api/partnerships/pilot-leads` lands, the service
 *   layer in `src/services/fundingService.js` is the single
 *   place to swap. This module stays as the local fallback
 *   so leads captured offline don't disappear.
 *
 * Strict-rule audit
 *   • Never throws — quota / private mode / corrupt JSON all
 *     degrade silently.
 *   • Bounded growth: capped at 500 leads on disk so a stuck
 *     write loop can't fill the slot.
 */

const STORAGE_KEY = 'farroway_ngo_pilot_leads';
const MAX_KEPT = 500;

/**
 * @typedef {Object} NgoPilotLead
 * @property {string} id
 * @property {string} organizationName
 * @property {string} country
 * @property {string} [numberOfFarmers]
 * @property {string} [goal]
 * @property {string} email
 * @property {string} [message]
 * @property {string} createdAt   ISO timestamp
 */

function _readList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode — ignore */ }
}

function _mintId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'lead_' + crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Persist a new lead and return the stored record.
 *
 * @param {Omit<NgoPilotLead, 'id' | 'createdAt'>} input
 * @returns {NgoPilotLead}
 */
export function saveNgoPilotLead(input) {
  const lead = {
    id:               _mintId(),
    organizationName: String(input?.organizationName || ''),
    country:          String(input?.country || ''),
    numberOfFarmers:  input?.numberOfFarmers ? String(input.numberOfFarmers) : '',
    goal:             input?.goal ? String(input.goal) : '',
    email:            String(input?.email || ''),
    message:          input?.message ? String(input.message) : '',
    createdAt:        (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
  };
  const list = _readList();
  list.push(lead);
  _writeList(list);
  return lead;
}

/** Read-only snapshot of all stored leads. */
export function getRecordedNgoPilotLeads() {
  return _readList();
}

/** Total stored leads on this device. Used by the admin tile. */
export function getNgoPilotLeadCount() {
  return _readList().length;
}

/** Wipe the local store. Server-pushed leads (when wired) live elsewhere. */
export function clearNgoPilotLeads() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export default {
  saveNgoPilotLead,
  getRecordedNgoPilotLeads,
  getNgoPilotLeadCount,
  clearNgoPilotLeads,
};
