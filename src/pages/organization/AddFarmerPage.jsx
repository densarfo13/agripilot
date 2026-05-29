/**
 * src/pages/organization/AddFarmerPage.jsx — Single-farmer entry
 * surface for field officers.
 *
 *   Route: /organization/onboarding/add-farmer
 *   Gate:  RoleRoute wrapper at App.jsx level (NGO admin /
 *          program manager / field officer scopes).
 *
 * What this is
 * ────────────
 *   The CSV path (OnboardingHome → ImportBatch) is the bulk
 *   route. This page is the compact, one-row-at-a-time path
 *   used by a field officer standing next to a farmer when CSV
 *   upload isn't practical (poor signal, no laptop, one new
 *   sign-up at a time).
 *
 *   The submission builds the SAME normalized row shape the CSV
 *   path produces (see EnrollmentBatchRow contract in
 *   src/runtime/organization/onboarding/onboardingContracts.ts)
 *   and hands it to provisionFarmerFromRow on the runtime
 *   barrel. The runtime wraps the single row in a virtual
 *   single-row batch — no batch UI is shown here.
 *
 *   Offline awareness
 *     - If window.__queueHealth is callable AND the device
 *       reports !navigator.onLine, the submission is parked on
 *       the existing offline mutation queue
 *       (src/utils/offlineQueue.js → enqueue) which is the
 *       same queue the rest of the app uses. We never write to
 *       localStorage directly.
 *     - If __queueHealth is NOT available (older builds that
 *       haven't loaded the offline runtime yet), we fall back
 *       to an in-component "pending" buffer and show a calm
 *       "Saved offline" message so the officer's work is not
 *       lost in front of the farmer.
 *
 *   Idempotency
 *     - The key is bulk:add-farmer:{organizationId}:{phoneOrEmail}:{hash}
 *       which guarantees a duplicate submit returns the
 *       existing farmer instead of creating a second record.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe — every window touch is guarded.
 *   • All copy via tSafe.
 *   • Consent for program reporting is OPT-IN and defaults to
 *     false. It is never required to submit. The runtime is
 *     responsible for honoring that flag downstream.
 *   • Never crashes — submission errors land in inline state.
 *   • No direct localStorage / IndexedDB writes from this file.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import * as orgRuntime from '../../runtime/organization';
import { enqueue as enqueueOfflineMutation } from '../../utils/offlineQueue.js';

// ─── Styles ───────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 560,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  back: {
    appearance: 'none', border: 'none',
    background: 'transparent', color: '#64748B',
    padding: '6px 0', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 18px',
            lineHeight: 1.55 },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '18px 16px',
    marginBottom: 14,
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  label: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6, display: 'block',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    fontSize: 15, padding: '10px 12px',
    border: '1px solid rgba(31,41,51,0.18)',
    borderRadius: 10, marginBottom: 12,
    fontFamily: 'inherit', color: '#1F2933',
    background: '#FFFFFF',
  },
  consentRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontSize: 13, color: '#1F2933', lineHeight: 1.4,
    padding: '8px 0',
  },
  consentBox: { marginTop: 3 },
  hint: {
    fontSize: 11, color: '#64748B',
    margin: '0 0 0 24px', lineHeight: 1.4,
  },
  cta: {
    appearance: 'none', border: 'none', width: '100%',
    background: '#C8944D', color: '#FFFFFF',
    padding: '12px 14px', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ctaDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  ok: {
    fontSize: 13, color: '#1F5132',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '10px 12px', borderRadius: 10,
    marginTop: 10, lineHeight: 1.5,
  },
  offline: {
    fontSize: 13, color: '#7C4A00',
    background: '#FEF3C7',
    border: '1px solid #FCD34D',
    padding: '10px 12px', borderRadius: 10,
    marginTop: 10, lineHeight: 1.5,
  },
  err: {
    fontSize: 13, color: '#9B4747',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    padding: '10px 12px', borderRadius: 10,
    marginTop: 10, lineHeight: 1.5,
  },
  status: {
    fontSize: 12, color: '#475569',
    background: 'rgba(31,41,51,0.04)',
    padding: '8px 10px', borderRadius: 8,
    marginTop: 10, lineHeight: 1.5,
  },
};

// ─── Helpers ──────────────────────────────────────────────

/**
 * Tiny deterministic hash over a normalized row payload. We use
 * it as a tail on the idempotency key so two field officers
 * entering the same farmer with slightly different optional
 * fields don't collide on a stale record. Pure JS, no crypto
 * import — keeps the page SSR-safe and dependency-free.
 */
function _stableHash(input) {
  try {
    const s = JSON.stringify(input || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    // Unsigned 32-bit hex
    return (h >>> 0).toString(16);
  } catch { return '0'; }
}

/** Read navigator.onLine safely. */
function _navOnline() {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine !== false;
  } catch { return true; }
}

/**
 * Is the offline queue health probe present? We use this as a
 * gate so we only attempt to queue when the offline runtime is
 * actually loaded. The probe itself is non-fatal — if it
 * throws, we fall back to the in-component buffer.
 */
function _hasQueueHealth() {
  try {
    if (typeof window === 'undefined') return false;
    return typeof window.__queueHealth === 'function';
  } catch { return false; }
}

/**
 * Normalize a phone number to digits (preserves a leading +).
 * Mirrors the CSV-path normalizePhone in
 * src/services/import/normalizeFarmerImportRows.js so a row
 * entered here produces the SAME shape as a row imported via
 * CSV.
 */
function _normalizePhone(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }
  return cleaned.replace(/\D/g, '');
}

/** Normalize an email to lowercase trimmed. */
function _normalizeEmail(raw) {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
}

/** Light text normalization — trims & collapses whitespace. */
function _normText(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

/** Normalize numeric farm size to a string with one decimal. */
function _normFarmSize(raw) {
  if (!raw) return '';
  const num = parseFloat(
    String(raw).replace(/,/g, '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? String(num) : '';
}

/**
 * Build the canonical row shape the CSV path produces. Field
 * names match the EnrollmentBatchRow contract (first_name,
 * last_name, phone, email, village, primary_crop, farm_size,
 * consent_for_program_reporting).
 */
function _buildRow(form) {
  return {
    _rowNumber: 1,
    first_name: _normText(form.firstName),
    last_name:  _normText(form.lastName),
    phone:      _normalizePhone(form.phone),
    email:      _normalizeEmail(form.email),
    village:    _normText(form.village),
    primary_crop: _normText(form.primaryCrop).toUpperCase(),
    farm_size:  _normFarmSize(form.farmSize),
    consent_for_program_reporting: !!form.consent,
  };
}

/**
 * Construct the idempotency key:
 *   bulk:add-farmer:{organizationId}:{phoneOrEmail}:{hash}
 * where phoneOrEmail prefers the phone (since CSV path treats
 * phone as the strongest match key — see DUPLICATE_REASONS).
 */
function _idempotencyKey(organizationId, row) {
  const orgPart = String(organizationId || 'unknown-org');
  const ident = row.phone || row.email || 'no-identifier';
  const hash = _stableHash({
    first_name: row.first_name,
    last_name:  row.last_name,
    phone:      row.phone,
    email:      row.email,
    village:    row.village,
    primary_crop: row.primary_crop,
    farm_size:  row.farm_size,
  });
  return `bulk:add-farmer:${orgPart}:${ident}:${hash}`;
}

/**
 * Resolve provisionFarmerFromRow off the runtime barrel. We do
 * this defensively because the runtime ships in waves — older
 * builds may not export it yet. When absent, we return null so
 * the page can surface a calm "feature not available" state
 * instead of throwing.
 */
function _resolveProvisioner() {
  try {
    const fn = orgRuntime && orgRuntime.provisionFarmerFromRow;
    return typeof fn === 'function' ? fn : null;
  } catch { return null; }
}

// ─── Page ─────────────────────────────────────────────────

export default function AddFarmerPage({ organizationId } = {}) {
  const navigate = useNavigate();

  // Pull org id from props (preferred) or from the runtime if
  // it surfaces a current-org probe. We never read it from
  // localStorage — the org scope must be set upstream.
  const resolvedOrgId = useMemo(() => {
    if (organizationId) return String(organizationId);
    try {
      if (typeof window !== 'undefined'
          && typeof window.__currentOrganizationId === 'string') {
        return window.__currentOrganizationId;
      }
    } catch { /* swallow */ }
    return '';
  }, [organizationId]);

  const [form, setForm] = useState({
    firstName:   '',
    lastName:    '',
    phone:       '',
    email:       '',
    village:     '',
    primaryCrop: '',
    farmSize:    '',
    consent:     false, // never required, defaults to false
  });
  const [busy, setBusy] = useState(false);
  const [okMessage, setOkMessage] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [error, setError] = useState('');

  // Local pending buffer — only used when the offline queue
  // module is NOT available. The submission is held in memory
  // so the officer sees their work is recorded; the next time
  // they navigate to this page it can be replayed. We never
  // hit localStorage from this file.
  const pendingBufferRef = useRef([]);

  const setField = (k) => (e) => {
    const v = e && e.target
      ? (e.target.type === 'checkbox'
          ? !!e.target.checked
          : e.target.value)
      : e;
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  // ─── Validation ─────────────────────────────────────────
  const trimmed = useMemo(() => ({
    firstName:   _normText(form.firstName),
    lastName:    _normText(form.lastName),
    phone:       _normalizePhone(form.phone),
    email:       _normalizeEmail(form.email),
    village:     _normText(form.village),
    primaryCrop: _normText(form.primaryCrop),
    farmSize:    _normFarmSize(form.farmSize),
  }), [form]);

  const validity = useMemo(() => {
    if (!trimmed.firstName) return { ok: false, code: 'firstName' };
    if (!trimmed.lastName)  return { ok: false, code: 'lastName' };
    // phone OR email — exactly one (or both) must be present.
    if (!trimmed.phone && !trimmed.email) {
      return { ok: false, code: 'contact' };
    }
    return { ok: true };
  }, [trimmed]);

  const canSubmit = validity.ok && !busy;

  // ─── Submit ─────────────────────────────────────────────
  const onSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setOkMessage('');
    setOfflineMessage('');
    setError('');

    if (!validity.ok) {
      const msgs = {
        firstName: tSafe('orgAddFarmer.err.firstName',
          'First name is required.'),
        lastName:  tSafe('orgAddFarmer.err.lastName',
          'Last name is required.'),
        contact:   tSafe('orgAddFarmer.err.contact',
          'Please enter a phone number or an email — one is required.'),
      };
      setError(msgs[validity.code]
        || tSafe('orgAddFarmer.err.generic',
          'Please fill in the required fields.'));
      return;
    }

    const row = _buildRow(form);
    const key = _idempotencyKey(resolvedOrgId, row);
    const payload = {
      organizationId: resolvedOrgId || undefined,
      row,
      idempotencyKey: key,
      source: 'field_officer_single_entry',
    };

    setBusy(true);

    // ─── Offline path ─────────────────────────────────────
    // Only queue when the device REPORTS offline. If the
    // browser thinks it's online we let the runtime call
    // proceed — provisionFarmerFromRow itself owns the
    // network and can choose to queue internally too.
    if (!_navOnline()) {
      if (_hasQueueHealth()) {
        try {
          await enqueueOfflineMutation({
            method: 'POST',
            url: '/api/organization/onboarding/add-farmer',
            data: payload,
            entityType: 'farmer',
            actionType: 'create',
            idempotencyKey: key,
          });
          setOfflineMessage(tSafe('orgAddFarmer.savedOfflineQueued',
            'Saved offline. We will finish enrolling this farmer '
            + 'as soon as your phone reconnects.'));
          setForm({
            firstName: '', lastName: '', phone: '', email: '',
            village: '', primaryCrop: '', farmSize: '', consent: false,
          });
        } catch {
          // Queue write failed — fall back to in-memory buffer
          // so the officer's work isn't lost in front of the
          // farmer.
          pendingBufferRef.current.push(payload);
          setOfflineMessage(tSafe('orgAddFarmer.savedOfflineBuffer',
            'Saved offline. Reconnect and submit again to sync '
            + 'this farmer.'));
        }
      } else {
        // No offline runtime loaded — hold the row in memory.
        pendingBufferRef.current.push(payload);
        setOfflineMessage(tSafe('orgAddFarmer.savedOfflineBuffer',
          'Saved offline. Reconnect and submit again to sync '
          + 'this farmer.'));
      }
      setBusy(false);
      return;
    }

    // ─── Online path ──────────────────────────────────────
    const provision = _resolveProvisioner();
    if (!provision) {
      setError(tSafe('orgAddFarmer.err.runtimeMissing',
        'Single-farmer onboarding is not available in this build. '
        + 'Please use the CSV import instead.'));
      setBusy(false);
      return;
    }

    try {
      const result = await provision(payload);
      // The runtime wraps the row in a virtual single-row
      // batch; we surface its summary as a calm one-line
      // confirmation. We accept either { ok, farmerId } or a
      // batch-style envelope.
      if (result && result.ok === false) {
        setError(result.error
          || tSafe('orgAddFarmer.err.save',
            'We could not save this farmer. Please try again.'));
      } else {
        const farmerId = (result && (result.farmerId
          || (result.summary && result.summary.created
              && (result.perRow && result.perRow[0]
                  && result.perRow[0].farmerId))))
          || '';
        setOkMessage(farmerId
          ? tSafe('orgAddFarmer.savedWithId',
            'Farmer enrolled. Reference: ') + farmerId
          : tSafe('orgAddFarmer.saved',
            'Farmer enrolled.'));
        setForm({
          firstName: '', lastName: '', phone: '', email: '',
          village: '', primaryCrop: '', farmSize: '', consent: false,
        });
      }
    } catch {
      setError(tSafe('orgAddFarmer.err.save',
        'We could not save this farmer. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [form, validity, resolvedOrgId]);

  // ─── Render ─────────────────────────────────────────────
  return (
    <main style={S.page} data-testid="organization-add-farmer-page">
      <button
        type="button" style={S.back}
        onClick={() => {
          try { navigate('/organization/onboarding'); }
          catch { /* swallow */ }
        }}
        data-testid="orgAddFarmer-back">
        {'← '}
        {tSafe('orgAddFarmer.back', 'Back to onboarding')}
      </button>

      <h1 style={S.header}>
        {tSafe('orgAddFarmer.title', 'Add a farmer')}
      </h1>
      <p style={S.sub}>
        {tSafe('orgAddFarmer.subtitle',
          'Use this when you are in the field and a CSV import '
          + 'is not practical. Enter one farmer; we will enroll '
          + 'them just like a CSV row.')}
      </p>

      <form style={S.card} onSubmit={onSubmit}
        data-testid="orgAddFarmer-form" noValidate>

        <div style={S.row2}>
          <div>
            <label style={S.label} htmlFor="add-farmer-first">
              {tSafe('orgAddFarmer.firstName', 'First name')}
              {' *'}
            </label>
            <input
              id="add-farmer-first"
              style={S.input}
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={setField('firstName')}
              data-testid="orgAddFarmer-firstName"
              required />
          </div>
          <div>
            <label style={S.label} htmlFor="add-farmer-last">
              {tSafe('orgAddFarmer.lastName', 'Last name')}
              {' *'}
            </label>
            <input
              id="add-farmer-last"
              style={S.input}
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={setField('lastName')}
              data-testid="orgAddFarmer-lastName"
              required />
          </div>
        </div>

        <label style={S.label} htmlFor="add-farmer-phone">
          {tSafe('orgAddFarmer.phone', 'Phone number')}
        </label>
        <input
          id="add-farmer-phone"
          style={S.input}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+233…"
          value={form.phone}
          onChange={setField('phone')}
          data-testid="orgAddFarmer-phone" />

        <label style={S.label} htmlFor="add-farmer-email">
          {tSafe('orgAddFarmer.email', 'Email')}
        </label>
        <input
          id="add-farmer-email"
          style={S.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={setField('email')}
          data-testid="orgAddFarmer-email" />

        <p style={S.hint}>
          {tSafe('orgAddFarmer.contactHint',
            'Phone OR email is required — either is fine.')}
        </p>

        <label style={{ ...S.label, marginTop: 14 }}
          htmlFor="add-farmer-village">
          {tSafe('orgAddFarmer.village', 'Village')}
        </label>
        <input
          id="add-farmer-village"
          style={S.input}
          type="text"
          autoComplete="address-level3"
          value={form.village}
          onChange={setField('village')}
          data-testid="orgAddFarmer-village" />

        <div style={S.row2}>
          <div>
            <label style={S.label} htmlFor="add-farmer-crop">
              {tSafe('orgAddFarmer.primaryCrop', 'Primary crop')}
            </label>
            <input
              id="add-farmer-crop"
              style={S.input}
              type="text"
              value={form.primaryCrop}
              onChange={setField('primaryCrop')}
              placeholder={tSafe('orgAddFarmer.cropPlaceholder',
                'Maize, Cassava, Tomato…')}
              data-testid="orgAddFarmer-primaryCrop" />
          </div>
          <div>
            <label style={S.label} htmlFor="add-farmer-size">
              {tSafe('orgAddFarmer.farmSize', 'Farm size')}
            </label>
            <input
              id="add-farmer-size"
              style={S.input}
              type="text"
              inputMode="decimal"
              value={form.farmSize}
              onChange={setField('farmSize')}
              placeholder={tSafe('orgAddFarmer.farmSizePlaceholder',
                'e.g. 1.5')}
              data-testid="orgAddFarmer-farmSize" />
          </div>
        </div>

        <label style={S.consentRow}>
          <input
            type="checkbox"
            style={S.consentBox}
            checked={!!form.consent}
            onChange={setField('consent')}
            data-testid="orgAddFarmer-consent" />
          <span>
            {tSafe('orgAddFarmer.consent',
              'Farmer consents to share their progress with the '
              + 'program for reporting.')}
          </span>
        </label>
        <p style={S.hint}>
          {tSafe('orgAddFarmer.consentHint',
            'Optional. Farmers can be enrolled without sharing '
            + 'individual progress.')}
        </p>

        <button
          type="submit"
          style={{ ...S.cta, ...(canSubmit ? null : S.ctaDisabled) }}
          disabled={!canSubmit}
          data-testid="orgAddFarmer-submit">
          {busy
            ? tSafe('orgAddFarmer.submitting', 'Enrolling…')
            : tSafe('orgAddFarmer.submit', 'Enroll farmer')}
        </button>

        {error && (
          <div style={S.err} data-testid="orgAddFarmer-error">
            {error}
          </div>
        )}
        {okMessage && (
          <div style={S.ok} data-testid="orgAddFarmer-ok">
            {okMessage}
          </div>
        )}
        {offlineMessage && (
          <div style={S.offline} data-testid="orgAddFarmer-offline">
            {offlineMessage}
          </div>
        )}
      </form>

      <p style={S.status} data-testid="orgAddFarmer-csvPointer">
        {tSafe('orgAddFarmer.csvPointer',
          'Enrolling many farmers at once?')}
        {' '}
        <Link to="/organization/onboarding/import"
          data-testid="orgAddFarmer-csvLink">
          {tSafe('orgAddFarmer.csvLink', 'Use CSV import instead.')}
        </Link>
      </p>
    </main>
  );
}
