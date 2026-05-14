/**
 * partnerApplicationStore — data-layer-only stub for the future
 * funding-partner intake flow.
 *
 *   import {
 *     submitPartnerApplication, getPartnerApplications,
 *     updatePartnerApplicationStatus, getReviewQueue,
 *   } from '../lib/partners/partnerApplicationStore.js';
 *
 *   submitPartnerApplication({
 *     orgName:     'Acme Microfinance',
 *     contactName: 'Jane Doe',
 *     contactEmail: 'jane@acme.example',
 *     kind:        'loan',
 *     regions:     ['US', 'GH'],
 *     summary:     '...',
 *   });
 *
 * Scope - intentionally minimal
 *   The full publish gate is not yet passed. Per the user's
 *   guard - "Do not expand major features until ..." - we ship
 *   only the data layer + review-queue helpers. NO UI surface
 *   is added; the form + admin review page wire in once
 *   stabilization passes the live-smoke checklist.
 *
 *   What this module DOES today:
 *     - validate + persist a partner application locally
 *     - assign a stable id + timestamp
 *     - expose the review queue (pending applications first,
 *       newest first within status)
 *     - move an application through the placeholder status
 *       pipeline: submitted -> reviewing -> approved | rejected
 *     - never display anything to a real user
 *
 *   What this module DOES NOT do today:
 *     - render a UI form
 *     - hit a backend endpoint
 *     - email partners
 *     - publish "approved" partners into the live funding feed
 *   Each of those is a follow-up wired AFTER smoke + UAT pass.
 *
 * Strict-rule audit
 *   * Pure JS, SSR-safe, never throws.
 *   * No fake-data leakage - real applications carry no demo
 *     marker; UAT seed data carries the UAT_DEMO tag and is
 *     filtered by getReviewQueue when `excludeDemo: true`.
 *   * Idempotent re-submission - a duplicate by orgName +
 *     contactEmail returns the existing id rather than
 *     creating a new row.
 */

const STORAGE_KEY = 'farroway_partner_applications_v1';

export const PARTNER_STATUS = Object.freeze({
  SUBMITTED:  'submitted',
  REVIEWING:  'reviewing',
  APPROVED:   'approved',
  REJECTED:   'rejected',
});

const _VALID_STATUS_TRANSITIONS = Object.freeze({
  submitted:  ['reviewing', 'rejected'],
  reviewing:  ['approved',  'rejected'],
  approved:   [],   // terminal
  rejected:   [],   // terminal
});

const _VALID_KINDS = new Set(['grant', 'loan', 'program', 'cooperative', 'other']);

function _now() { try { return Date.now(); } catch { return 0; } }

function _safeStr(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function _safeArrStr(v) {
  if (!Array.isArray(v)) return [];
  return v.map(_safeStr).filter(Boolean);
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _write(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* swallow */ }
}

function _genId() {
  try {
    return 'partner_' + Math.random().toString(36).slice(2, 10) + '_' + _now().toString(36);
  } catch { return 'partner_unknown_' + _now(); }
}

function _normalisePayload(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const orgName     = _safeStr(safe.orgName);
  const contactName = _safeStr(safe.contactName);
  const contactEmail = _safeStr(safe.contactEmail);
  // Hard requirements - reject submissions missing identifying
  // fields. Soft fields (summary, website) are optional.
  if (!orgName || !contactName || !contactEmail) {
    return { ok: false, reason: 'missing_required_fields' };
  }
  const kindRaw = _safeStr(safe.kind) || 'other';
  const kind = _VALID_KINDS.has(kindRaw.toLowerCase()) ? kindRaw.toLowerCase() : 'other';
  return {
    ok:           true,
    payload: {
      orgName,
      contactName,
      contactEmail,
      contactPhone: _safeStr(safe.contactPhone),
      website:      _safeStr(safe.website),
      kind,
      regions:      _safeArrStr(safe.regions),
      cropFocus:    _safeArrStr(safe.cropFocus),
      summary:      _safeStr(safe.summary),
      maxFundingPerFarmer: Number.isFinite(safe.maxFundingPerFarmer)
                              ? Number(safe.maxFundingPerFarmer) : null,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Persist a new partner application. Idempotent on
 * (orgName, contactEmail) so a stakeholder re-submitting the
 * same form does not flood the review queue.
 *
 * @returns {object} { ok, id?, reason?, application? }
 */
export function submitPartnerApplication(input) {
  const norm = _normalisePayload(input);
  if (!norm.ok) return { ok: false, reason: norm.reason };

  const list = _read();
  const existing = list.find(
    (a) => a && a.orgName === norm.payload.orgName
        && a.contactEmail === norm.payload.contactEmail
        && a.status !== PARTNER_STATUS.REJECTED,
  );
  if (existing) {
    return { ok: true, id: existing.id, application: existing, deduped: true };
  }

  const application = Object.freeze({
    id:          _genId(),
    submittedAt: _now(),
    updatedAt:   _now(),
    status:      PARTNER_STATUS.SUBMITTED,
    reviewedBy:  null,
    reviewNotes: null,
    ...norm.payload,
  });
  list.push(application);
  _write(list);
  return { ok: true, id: application.id, application };
}

/**
 * @returns {Array} every application, frozen + sorted newest-first
 */
export function getPartnerApplications() {
  const list = _read();
  list.sort((a, b) => (b && b.submittedAt || 0) - (a && a.submittedAt || 0));
  return list.map((row) => Object.freeze(row));
}

/**
 * Review-queue view — pending applications first, then in-progress,
 * then terminal. Optional filter excludes demo / UAT-tagged rows.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.excludeDemo=false]
 * @returns {{ pending: Array, reviewing: Array, terminal: Array }}
 */
export function getReviewQueue(opts) {
  const excludeDemo = !!(opts && opts.excludeDemo);
  const all = getPartnerApplications();
  const kept = excludeDemo ? all.filter((a) => a && a.demo !== true && a.tag !== 'UAT_DEMO') : all;
  return Object.freeze({
    pending:   kept.filter((a) => a.status === PARTNER_STATUS.SUBMITTED),
    reviewing: kept.filter((a) => a.status === PARTNER_STATUS.REVIEWING),
    terminal:  kept.filter((a) =>
      a.status === PARTNER_STATUS.APPROVED || a.status === PARTNER_STATUS.REJECTED,
    ),
  });
}

/**
 * Move an application through the placeholder approval pipeline.
 * Validates transitions against _VALID_STATUS_TRANSITIONS so a
 * caller cannot jump submitted -> approved (mandatory review
 * step in between).
 *
 * @param {string} id
 * @param {('reviewing'|'approved'|'rejected')} nextStatus
 * @param {object} [meta]
 * @param {string} [meta.reviewedBy]
 * @param {string} [meta.reviewNotes]
 * @returns {{ ok, reason?, application? }}
 */
export function updatePartnerApplicationStatus(id, nextStatus, meta) {
  if (!_safeStr(id)) return { ok: false, reason: 'missing_id' };
  if (!_safeStr(nextStatus)) return { ok: false, reason: 'missing_status' };
  const list = _read();
  const idx = list.findIndex((a) => a && a.id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  const current = list[idx];
  const allowed = _VALID_STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(nextStatus)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  const meta2 = (meta && typeof meta === 'object') ? meta : {};
  const updated = {
    ...current,
    status:      nextStatus,
    updatedAt:   _now(),
    reviewedBy:  _safeStr(meta2.reviewedBy)  || current.reviewedBy,
    reviewNotes: _safeStr(meta2.reviewNotes) || current.reviewNotes,
  };
  list[idx] = updated;
  _write(list);
  return { ok: true, application: Object.freeze(updated) };
}

/** Test seam — flushes the store. Production code should never call this. */
export function _resetPartnerApplications() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch { /* swallow */ }
}

const _module = {
  PARTNER_STATUS,
  submitPartnerApplication,
  getPartnerApplications,
  getReviewQueue,
  updatePartnerApplicationStatus,
  _resetPartnerApplications,
};
export default _module;
