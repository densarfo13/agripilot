/**
 * fundingService.js — API-ready wrapper layer for the Funding Hub.
 *
 * Why this exists
 * ───────────────
 * The Funding Hub ships with a static catalog (`fundingConfig.js`)
 * + a localStorage lead store (`data/ngoPilotLeads.js`). When a
 * backend pipeline lands (`/api/funding/programs`, `/api/
 * partnerships/pilot-leads`), the call sites should NOT have to
 * change. This thin service module is the single seam they all
 * route through — swap the implementation here, every consumer
 * stays working.
 *
 * Strict-rule audit
 *   • Async-by-default so the future migration to a real fetch
 *     is a transparent swap.
 *   • Never throws — defensive try/catch around every storage
 *     and dynamic-import call.
 *   • Behind no feature flag — the service is an infra primitive,
 *     consumers gate on the relevant feature flags themselves.
 */

import { FUNDING_PROGRAMS, getRegionFundingCatalog } from '../config/fundingConfig.js';
import { saveNgoPilotLead, getRecordedNgoPilotLeads } from '../data/ngoPilotLeads.js';

/**
 * fetchFundingPrograms — returns the full catalog. Currently
 * resolves the static array; will fetch from the server when the
 * backend pipeline lands. Always async to avoid a future
 * shape-breaking migration.
 *
 * @returns {Promise<Array<object>>}
 */
export async function fetchFundingPrograms() {
  try { return Array.from(FUNDING_PROGRAMS); }
  catch { return []; }
}

/**
 * fetchFundingProgramsForCountry — country-scoped fetch.
 * Wraps the existing `getRegionFundingCatalog` helper.
 */
export async function fetchFundingProgramsForCountry(country) {
  try { return getRegionFundingCatalog(country); }
  catch { return []; }
}

/**
 * submitPilotLead — accepts the form payload, validates the
 * minimum required fields, persists locally, and returns the
 * stored lead. The future server path will look like:
 *
 *     POST /api/partnerships/pilot-leads
 *
 * Both shapes return the same `{ id, createdAt, ... }` stored
 * record so consumers can show a confirmation immediately.
 *
 * @param {object} input
 * @param {string} input.organizationName
 * @param {string} input.country
 * @param {string} [input.numberOfFarmers]
 * @param {string} [input.goal]
 * @param {string} input.email
 * @param {string} [input.message]
 */
export async function submitPilotLead(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'invalid_input' };
  }
  const { organizationName, email } = input;
  if (!organizationName || !email) {
    return { ok: false, error: 'missing_required' };
  }
  try {
    const lead = saveNgoPilotLead({
      organizationName: String(organizationName),
      country:          String(input.country || ''),
      numberOfFarmers:  input.numberOfFarmers ? String(input.numberOfFarmers) : '',
      goal:             input.goal ? String(input.goal) : '',
      email:            String(email),
      message:          input.message ? String(input.message) : '',
    });
    return { ok: true, lead };
  } catch (err) {
    return { ok: false, error: 'storage_failed', detail: err && err.message };
  }
}

/**
 * Pass-through read for any debug / admin surface that wants to
 * inspect the locally-stored leads.
 */
export async function listLocalPilotLeads() {
  try { return getRecordedNgoPilotLeads(); }
  catch { return []; }
}

export default {
  fetchFundingPrograms,
  fetchFundingProgramsForCountry,
  submitPilotLead,
  listLocalPilotLeads,
};
