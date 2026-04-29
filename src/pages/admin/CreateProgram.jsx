/**
 * CreateProgram — admin / NGO surface for composing and
 * sending a Program to matched farmers.
 *
 *   <Route path="/admin/programs" element={<CreateProgram />} />
 *   <Route path="/ngo/programs"   element={<CreateProgram />} />
 *
 * Spec contract (NGO Programs, § 3)
 *   * Fields: title, type, message, crops, regions, deadline.
 *   * On submit:
 *       - createProgram(...)
 *       - find matching farmers
 *       - createDeliveries(program, farmers)
 *
 * Strict-rule audit
 *   * Local-first — works without a backend. Farmers list
 *     comes from the existing `getFarms()` helper used by
 *     NGOMapDashboard (cached on the device).
 *   * Privacy: program rows store only target rules + the
 *     creating user's id. Farmer name / phone / email never
 *     touch the program record.
 *   * Anti-spam (per spec § 8 + § 9): the form shows the
 *     count of farmers a program will reach BEFORE submit,
 *     so an over-broad program is obvious to the operator.
 *     The Today screen also caps to ACTIVE_LIMIT cards.
 *   * Honest feedback: success copy reports the exact
 *     number of new deliveries created (skipping duplicates
 *     on retry).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createProgram, createDeliveries, resolveMatchingFarmers,
  getPrograms, programPerformanceSummary,
  PROGRAM_TYPES,
} from '../../programs/programStore.js';
import { getFarms } from '../../api/ngoApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';
import BrandLogo from '../../components/BrandLogo.jsx';
import {
  ErrorState, LoadingState,
} from '../../components/admin/AdminState.jsx';

const C = FARROWAY_BRAND.colors;

const EMPTY_FORM = Object.freeze({
  title:    '',
  type:     'announcement',
  message:  '',
  crops:    '',     // CSV
  regions:  '',     // CSV
  deadline: '',
});

export default function CreateProgram() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [farms, setFarms]       = useState([]);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [farmsError, setFarmsError]     = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [flash, setFlash]       = useState('');
  const [errMsg, setErrMsg]     = useState('');
  const [recent, setRecent]     = useState(() => getPrograms().slice(0, 5));

  // Fetch farms via the existing NGO API helper. Returns
  // [] on failure (offline / 401 / 404) — the form still
  // works; createDeliveries will resolve to 0 matches and
  // surface that honestly to the operator.
  useEffect(() => {
    let alive = true;
    setFarmsLoading(true);
    getFarms()
      .then((rows) => {
        if (!alive) return;
        setFarms(Array.isArray(rows) ? rows : []);
        setFarmsError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setFarmsError(err && err.message ? err.message
          : 'Could not fetch farmer list');
      })
      .finally(() => { if (alive) setFarmsLoading(false); });
    return () => { alive = false; };
  }, []);

  // Live "this would reach N farmers" preview using the
  // pure resolver. Operators see scope BEFORE pressing Send.
  const matchPreview = useMemo(() => {
    const draftProgram = {
      target: {
        crops:   _csv(form.crops),
        regions: _csv(form.regions),
        farmerIds: [],
      },
      deadline: form.deadline || null,
    };
    return resolveMatchingFarmers(draftProgram, farms).length;
  }, [form.crops, form.regions, form.deadline, farms]);

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrMsg('');
    if (submitting) return;
    if (!String(form.title).trim()) {
      setErrMsg(tSafe('program.error.titleRequired',
        'Please give the program a title.'));
      return;
    }
    if (!String(form.message).trim()) {
      setErrMsg(tSafe('program.error.messageRequired',
        'Please add a short message for the farmer.'));
      return;
    }

    setSubmitting(true);
    try {
      const program = createProgram({
        title:     form.title,
        type:      form.type,
        message:   form.message,
        target: {
          crops:   _csv(form.crops),
          regions: _csv(form.regions),
          farmerIds: [],
        },
        deadline:  form.deadline || null,
        createdBy: user?.sub || null,
      });

      const sent = createDeliveries(program, farms);
      setFlash(tSafe('program.sent',
        `Sent to ${sent.length} farmer${sent.length === 1 ? '' : 's'}.`));
      setForm(EMPTY_FORM);
      setRecent(getPrograms().slice(0, 5));
      setTimeout(() => setFlash(''), 4000);
    } catch (err) {
      setErrMsg(err && err.message ? err.message
        : tSafe('program.error.saveFailed',
          'Could not send the program. Try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  }

  const perfRows = useMemo(() => programPerformanceSummary().slice(0, 5),
                           [recent.length]);

  return (
    <main style={S.page} data-testid="create-program-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.h1}>
            {tSafe('program.adminTitle', 'Send a program to farmers')}
          </h1>
          <p style={S.lead}>
            {tSafe('program.adminLead',
              'Compose a short message and choose which farmers receive it. Empty crops + regions = send to everyone.')}
          </p>
        </header>

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <Field label={tSafe('program.title', 'Title')}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Rainfall warning"
              style={S.input}
              data-testid="create-program-title"
              required
            />
          </Field>

          <div style={S.row}>
            <Field label={tSafe('program.type', 'Type')} flex={1}>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                style={S.input}
                data-testid="create-program-type"
              >
                {PROGRAM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label={tSafe('program.deadline', 'Deadline (optional)')} flex={1}>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setField('deadline', e.target.value)}
                style={S.input}
                data-testid="create-program-deadline"
              />
            </Field>
          </div>

          <Field label={tSafe('program.message',
            'Message (short, plain language)')}>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              placeholder="Heavy rain expected this weekend — protect your seedlings."
              style={{ ...S.input, resize: 'vertical' }}
              data-testid="create-program-message"
              required
            />
          </Field>

          <Field label={tSafe('program.crops',
            'Target crops (comma-separated, blank = any)')}>
            <input
              type="text"
              value={form.crops}
              onChange={(e) => setField('crops', e.target.value)}
              placeholder="maize, cassava"
              style={S.input}
              data-testid="create-program-crops"
            />
          </Field>

          <Field label={tSafe('program.regions',
            'Target regions (comma-separated, blank = any)')}>
            <input
              type="text"
              value={form.regions}
              onChange={(e) => setField('regions', e.target.value)}
              placeholder="Ashanti, Northern"
              style={S.input}
              data-testid="create-program-regions"
            />
          </Field>

          <div style={S.preview} data-testid="create-program-preview">
            {farmsLoading ? (
              <span style={S.previewMuted}>
                {tSafe('program.previewLoading',
                  'Loading farmer list…')}
              </span>
            ) : farmsError ? (
              <span style={S.previewMuted}>
                {tSafe('program.previewNoFarmers',
                  'Farmer list unavailable. The program will save, but no deliveries will be created until the list loads.')}
              </span>
            ) : (
              <>
                <span style={S.previewIcon} aria-hidden="true">🎯</span>
                <span>
                  {tSafe('program.previewMatchHead', 'Matches')}:{' '}
                  <strong style={{ color: C.lightGreen }}>
                    {matchPreview}
                  </strong>
                  {' '}
                  {matchPreview === 1
                    ? tSafe('program.previewOneFarmer', 'farmer')
                    : tSafe('program.previewManyFarmers', 'farmers')}
                </span>
                <span style={S.previewMuted}>
                  ({farms.length} {tSafe('program.previewKnown', 'known')})
                </span>
              </>
            )}
          </div>

          {errMsg && (
            <p style={S.formError} role="alert">{errMsg}</p>
          )}
          {flash && (
            <p style={S.flash} role="status" aria-live="polite">{flash}</p>
          )}

          <div style={S.actions}>
            <button
              type="submit"
              disabled={submitting}
              style={{ ...S.btnPrimary,
                       opacity: submitting ? 0.7 : 1 }}
              data-testid="create-program-submit"
            >
              {submitting
                ? tSafe('program.sending', 'Sending…')
                : tSafe('program.send', 'Send Program')}
            </button>
            <Link to="/admin/funding" style={S.btnGhost}>
              {tSafe('program.backToFunding', 'Manage funding')}
            </Link>
          </div>
        </form>

        {/* Recent + performance — kept compact so the form
            stays the primary surface. The full performance
            table lives in the NGO dashboard. */}
        {perfRows.length > 0 && (
          <section style={S.recent} data-testid="create-program-recent">
            <h2 style={S.h2}>
              {tSafe('program.recent', 'Recent programs')}
            </h2>
            <ul style={S.recentList}>
              {perfRows.map((r) => (
                <li key={r.programId} style={S.recentRow}>
                  <span style={S.recentTitle}>{r.title}</span>
                  <span style={S.recentMeta}>
                    {r.sent} sent · {r.opened} opened · {r.acted} acted
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!farmsLoading && farmsError && (
          <ErrorState
            message={tSafe('program.farmsLoadError',
              'Could not fetch the farmer list. New programs save, but deliveries are skipped until the list loads.')}
            onRetry={() => window.location.reload()}
            testId="create-program-farms-error"
          />
        )}
        {farmsLoading && (
          <LoadingState message={tSafe('common.loading', 'Loading…')} />
        )}
      </div>
    </main>
  );
}

function _csv(s) {
  return String(s || '')
    .split(',').map((x) => x.trim()).filter(Boolean);
}

function Field({ label, children, flex }) {
  return (
    <label style={{
      ...S.field, ...(flex ? { flex } : {}),
    }}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '40rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  h1:    { margin: '0.4rem 0 0', fontSize: '1.5rem',
           fontWeight: 800, color: C.white,
           letterSpacing: '-0.01em' },
  lead:  { margin: 0, color: 'rgba(255,255,255,0.7)',
           fontSize: '0.9375rem' },
  form: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  row: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem',
           color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem',
           flex: '1 1 100%' },
  fieldLabel: { fontWeight: 700, color: 'rgba(255,255,255,0.7)' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  preview: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    gap: '0.45rem',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    color: C.white, fontSize: '0.875rem',
  },
  previewIcon:  { fontSize: '1rem' },
  previewMuted: { color: 'rgba(255,255,255,0.55)',
                  fontSize: '0.8125rem' },
  formError: {
    margin: 0, color: '#FCA5A5', fontSize: '0.875rem',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    borderRadius: '8px', padding: '0.5rem 0.75rem',
  },
  flash: {
    margin: 0, color: C.lightGreen, fontWeight: 700,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  btnPrimary: {
    padding: '0.85rem 1.4rem', borderRadius: '12px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(34,197,94,0.25)',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.85rem 1.2rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none',
  },
  recent: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  h2:        { margin: 0, fontSize: '0.9375rem', fontWeight: 800 },
  recentList:{ listStyle: 'none', padding: 0, margin: 0,
               display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  recentRow: {
    display: 'flex', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '0.6rem',
    padding: '0.45rem 0.7rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
  },
  recentTitle: { color: C.white, fontWeight: 700,
                 fontSize: '0.875rem' },
  recentMeta:  { color: 'rgba(255,255,255,0.65)',
                 fontSize: '0.8125rem' },
};
