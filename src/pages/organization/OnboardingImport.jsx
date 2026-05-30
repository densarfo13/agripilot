/**
 * src/pages/organization/OnboardingImport.jsx — 5-step bulk
 * onboarding wizard for NGO admins.
 *
 *   Route: /organization/onboarding/import
 *   Gate:  RoleRoute wrapper at App.jsx level. Runtime probe
 *          window.__bulkOnboardingHealth() must return
 *          available:true; otherwise a Forbidden empty state
 *          renders (defence-in-depth).
 *
 * Steps
 * ─────
 *   1. Upload   — file input, .csv only.
 *   2. Validate — "Validating…" while uploading.
 *   3. Preview  — buckets: Valid / Invalid / Duplicate.
 *   4. Resolve  — duplicate rows with skip/link/review-later.
 *   5. Confirm  — final Confirm button + summary.
 *
 *   After confirm: import result panel with imported/failed/
 *   skipped counts.
 *
 * Data
 * ────
 *   Reads frozen snapshots from window.bulkOnboardingRuntime.
 *   Writes go through a (stubbed) API client — no direct fetch.
 *   The hook is left wired-but-inert so a future runtime can
 *   drop in without page edits.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Never crashes — every runtime read wrapped in try/catch.
 *   • No direct fetch calls.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { useApiClient } from '../../hooks/useApiClient.js';
import { trackEvent } from '../../core/analytics.js';

const IMPORT_SUCCESS_STATUSES = [
  'completed',
  'imported',
  'imported_invite_sent',
  'imported_pending_invite',
];

const STEPS = [
  { key: 'upload',   label: 'Upload CSV'        },
  { key: 'validate', label: 'Validate'          },
  { key: 'preview',  label: 'Preview'           },
  { key: 'resolve',  label: 'Resolve duplicates' },
  { key: 'confirm',  label: 'Confirm import'    },
];

const ROW_STATUS_COLOR = {
  valid:     '#16A34A',
  invalid:   '#B91C1C',
  duplicate: '#B45309',
  imported:  '#16A34A',
  failed:    '#B91C1C',
};

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 960,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 18px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  stepper: {
    display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14,
  },
  stepPill: {
    fontSize: 11, fontWeight: 700,
    padding: '5px 10px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)', color: '#475569',
  },
  stepPillActive: {
    background: '#C8944D', color: '#FFFFFF',
  },
  stepPillDone: {
    background: 'rgba(22,163,74,0.15)', color: '#15803D',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '16px 16px',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14, fontWeight: 800,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 13, color: '#475569', lineHeight: 1.5,
    marginBottom: 10,
  },
  fileInput: {
    fontSize: 13,
    fontFamily: 'inherit',
  },
  actionsRow: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
    marginTop: 12,
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ctaGhost: {
    appearance: 'none',
    border: '1px solid rgba(31,41,51,0.16)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  bucketRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap',
    marginBottom: 10,
  },
  bucket: {
    flex: '1 1 140px',
    background: 'rgba(31,41,51,0.04)',
    borderRadius: 8,
    padding: '10px 12px',
  },
  bucketCount: { fontSize: 20, fontWeight: 800 },
  bucketLabel: { fontSize: 11, color: '#475569',
                  textTransform: 'uppercase', letterSpacing: '0.06em' },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
  },
  th: {
    textAlign: 'left', fontWeight: 700, color: '#475569',
    padding: '6px 8px',
    borderBottom: '1px solid rgba(31,41,51,0.1)',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    verticalAlign: 'top',
  },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  inlineActions: {
    display: 'flex', gap: 4, flexWrap: 'wrap',
  },
  miniBtn: {
    appearance: 'none', border: '1px solid rgba(31,41,51,0.16)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '3px 7px', borderRadius: 6,
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  miniBtnActive: {
    background: '#C8944D', color: '#FFFFFF',
    borderColor: '#C8944D',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 0', fontSize: 13,
    borderBottom: '1px solid rgba(31,41,51,0.05)',
  },
};

function _safeProbe(name) {
  try {
    if (typeof window === 'undefined') return null;
    const fn = window[name];
    if (typeof fn !== 'function') return null;
    return fn();
  } catch { return null; }
}

function _runtimeSnapshot(batchId) {
  try {
    if (typeof window === 'undefined') return null;
    const rt = window.bulkOnboardingRuntime;
    if (!rt) return null;
    if (batchId && typeof rt.getBatchSnapshot === 'function') {
      return rt.getBatchSnapshot(batchId);
    }
    if (typeof rt.getDraftSnapshot === 'function') {
      return rt.getDraftSnapshot();
    }
    return null;
  } catch { return null; }
}

export default function OnboardingImportPage() {
  const { api: apiClient } = useApiClient();
  let navigate = null;
  try { navigate = useNavigate(); } catch { navigate = null; }
  const [stepIndex, setStepIndex] = useState(0);
  const [file, setFile]           = useState(null);
  const [batchId, setBatchId]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateActions, setDuplicateActions] = useState({});
  const [confirmResult, setConfirmResult] = useState(null);
  const [confirmFailure, setConfirmFailure] = useState(null);
  const [apiError, setApiError] = useState(null);

  const health = useMemo(() => _safeProbe('__bulkOnboardingHealth'), []);
  const available = health && health.available !== false;

  const snapshot = useMemo(
    () => _runtimeSnapshot(batchId),
    [batchId, stepIndex],
  );

  const buckets = useMemo(() => {
    const s = snapshot || {};
    const rows = Array.isArray(s.rows) ? s.rows : [];
    const validRows     = rows.filter((r) => r && r.status === 'valid');
    const invalidRows   = rows.filter((r) => r && r.status === 'invalid');
    const duplicateRows = rows.filter((r) => r && r.status === 'duplicate');
    return {
      total: rows.length,
      valid: validRows,
      invalid: invalidRows,
      duplicate: duplicateRows,
    };
  }, [snapshot]);

  const onPickFile = useCallback((e) => {
    const f = (e && e.target && e.target.files && e.target.files[0]) || null;
    setFile(f);
    setApiError(null);
  }, []);

  const onUpload = useCallback(async () => {
    if (!file) return;
    setSubmitting(true);
    setApiError(null);
    setStepIndex(1); // Validate step shows the spinner
    try {
      // API client stub — wires to the real endpoint when the
      // runtime backend ships. Pages never call fetch directly.
      const form = new FormData();
      form.append('file', file);
      let result = null;
      if (apiClient && typeof apiClient.post === 'function') {
        result = await apiClient.post(
          '/organization/onboarding/batches', form);
      }
      // Truth rule: success requires backend confirmation. Never
      // synthesize a local draft batchId — that produced silent
      // "0 imported / 0 failed / 0 skipped" success after 503s.
      const confirmedId =
        (result && result.data && result.data.batchId)
          || (result && result.batchId)
          || null;
      if (!result || !confirmedId) {
        setApiError(tSafe(
          'orgOnboardingImport.uploadFailed',
          'Upload could not be completed.'));
        setStepIndex(0);
        return;
      }
      setBatchId(confirmedId);
      setStepIndex(2);
    } catch (e) {
      setApiError(String((e && e.message) || e));
      setStepIndex(0);
    } finally {
      setSubmitting(false);
    }
  }, [file, apiClient]);

  const onMarkDuplicate = useCallback((rowId, action) => {
    setDuplicateActions((prev) => ({ ...prev, [rowId]: action }));
    try {
      if (apiClient && typeof apiClient.post === 'function') {
        const p = apiClient.post(
          `/organization/onboarding/batches/${batchId}/duplicates/${rowId}`,
          { action },
        );
        if (p && typeof p.then === 'function') {
          p.then((result) => {
            // Truth rule: surface backend failure rather than
            // silently swallowing — the user's choice did not
            // persist if the API returned an error/null body.
            if (!result || (result && result.error)) {
              setApiError(tSafe(
                'orgOnboardingImport.duplicateActionFailed',
                'Duplicate action could not be saved.'));
            }
          }).catch((e) => {
            setApiError(String((e && e.message) || e));
          });
        }
      }
    } catch (e) {
      setApiError(String((e && e.message) || e));
    }
  }, [batchId, apiClient]);

  const onConfirmImport = useCallback(async () => {
    setSubmitting(true);
    setApiError(null);
    setConfirmFailure(null);
    try {
      let result = null;
      if (apiClient && typeof apiClient.post === 'function') {
        result = await apiClient.post(
          `/organization/onboarding/batches/${batchId}/commit`,
          { duplicateActions });
      }
      // Truth rule: success requires backend confirmation with
      // an allowed status AND either importedRows or createdRows.
      // 503s, null bodies, or missing fields must surface as a
      // failure panel — never as a fake "0 imported" success.
      const payload = (result && result.data) || null;
      const status = payload && payload.status;
      const importedCount = payload
        ? Number(
            (payload.importedRows != null
              ? payload.importedRows
              : payload.createdRows) || 0,
          )
        : 0;
      const hasImportedField = payload
        && (payload.importedRows != null
          || payload.createdRows != null);
      const isSuccess = !!payload
        && IMPORT_SUCCESS_STATUSES.indexOf(status) !== -1
        && hasImportedField;

      if (!isSuccess) {
        setConfirmFailure({
          title: tSafe(
            'orgOnboardingImport.failTitle',
            'Import could not be completed.'),
          body: tSafe(
            'orgOnboardingImport.failBody',
            'Farroway could not save this import right now. '
            + 'Please try again after persistence is available.'),
        });
        setApiError(tSafe(
          'orgOnboardingImport.failTitle',
          'Import could not be completed.'));
        return;
      }

      setConfirmResult({
        imported: importedCount,
        failed:   Number(payload.failedRows  || payload.failed  || 0),
        skipped:  Number(payload.skippedRows || payload.skipped || 0),
        status,
        batchId: payload.batchId || batchId,
      });
    } catch (e) {
      setApiError(String((e && e.message) || e));
      setConfirmFailure({
        title: tSafe(
          'orgOnboardingImport.failTitle',
          'Import could not be completed.'),
        body: tSafe(
          'orgOnboardingImport.failBody',
          'Farroway could not save this import right now. '
          + 'Please try again after persistence is available.'),
      });
    } finally {
      setSubmitting(false);
    }
  }, [batchId, duplicateActions, apiClient]);

  const onDownloadErrorRows = useCallback(() => {
    try {
      trackEvent('org_onboarding_import_download_error_rows', {
        batchId: batchId || null,
      });
    } catch { /* analytics swallow */ }
  }, [batchId]);

  const onBackToBatches = useCallback(() => {
    try {
      trackEvent('org_onboarding_import_back_to_batches', {
        batchId: batchId || null,
      });
    } catch { /* analytics swallow */ }
    if (navigate) {
      navigate('/organization/onboarding/batches');
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.assign('/organization/onboarding/batches');
    }
  }, [batchId, navigate]);

  const onRetryImport = useCallback(() => {
    try {
      trackEvent('org_onboarding_import_retry', {
        batchId: batchId || null,
      });
    } catch { /* analytics swallow */ }
    setConfirmFailure(null);
    setApiError(null);
    onConfirmImport();
  }, [batchId, onConfirmImport]);

  if (!available) {
    return (
      <main style={S.page}
        data-testid="organization-onboarding-import-wizard"
        data-forbidden="true">
        <h1 style={S.header}>
          {tSafe('orgOnboardingImport.title', 'Start an import')}
        </h1>
        <div style={S.empty}>
          {tSafe('orgOnboardingImport.forbidden',
            'This feature is not available for your account.')}
        </div>
      </main>
    );
  }

  const renderStepper = () => (
    <div style={S.stepper} data-testid="orgOnboardingImport-stepper">
      {STEPS.map((s, i) => {
        const style = i === stepIndex
          ? { ...S.stepPill, ...S.stepPillActive }
          : i < stepIndex
            ? { ...S.stepPill, ...S.stepPillDone }
            : S.stepPill;
        return (
          <span key={s.key} style={style}
            data-testid={`orgOnboardingImport-step-${s.key}`}
            data-active={i === stepIndex ? 'true' : 'false'}>
            {i + 1}. {tSafe('orgOnboardingImport.step_' + s.key, s.label)}
          </span>
        );
      })}
    </div>
  );

  return (
    <main style={S.page} data-testid="organization-onboarding-import-wizard">
      <h1 style={S.header}>
        {tSafe('orgOnboardingImport.title', 'Start an import')}
      </h1>
      <p style={S.sub}>
        {tSafe('orgOnboardingImport.subtitle',
          'Upload your farmer roster CSV — validate, resolve '
          + 'duplicates, then commit.')}
      </p>

      {renderStepper()}

      {apiError ? (
        <section style={{ ...S.card, borderColor: '#FCA5A5',
                           background: '#FEF2F2' }}
          data-testid="orgOnboardingImport-error">
          <div style={{ fontSize: 12, fontWeight: 700,
                         color: '#B91C1C' }}>
            {tSafe('orgOnboardingImport.errorTitle', 'Something went wrong')}
          </div>
          <div style={{ fontSize: 12, color: '#1F2933' }}>{apiError}</div>
        </section>
      ) : null}

      {/* Step 1 — Upload */}
      {stepIndex === 0 ? (
        <section style={S.card}
          data-testid="orgOnboardingImport-step-upload-card">
          <div style={S.cardTitle}>
            {tSafe('orgOnboardingImport.uploadTitle', 'Upload your CSV')}
          </div>
          <div style={S.cardBody}>
            {tSafe('orgOnboardingImport.uploadBody',
              'Select a .csv file. Only .csv is accepted — '
              + 'XLSX must be exported first.')}
          </div>
          <input type="file" accept=".csv"
            onChange={onPickFile}
            style={S.fileInput}
            data-testid="orgOnboardingImport-file-input" />
          <div style={S.actionsRow}>
            <button type="button" style={S.cta}
              disabled={!file || submitting}
              onClick={onUpload}
              data-testid="orgOnboardingImport-upload-btn">
              {tSafe('orgOnboardingImport.uploadCta', 'Validate file')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 2 — Validate (spinner) */}
      {stepIndex === 1 ? (
        <section style={S.card}
          data-testid="orgOnboardingImport-step-validate-card">
          <div style={S.cardTitle}>
            {tSafe('orgOnboardingImport.validateTitle', 'Validating…')}
          </div>
          <div style={S.cardBody}>
            {tSafe('orgOnboardingImport.validateBody',
              'Parsing headers, checking required columns, '
              + 'detecting duplicates. This usually takes a few '
              + 'seconds.')}
          </div>
        </section>
      ) : null}

      {/* Step 3 — Preview buckets */}
      {stepIndex === 2 ? (
        <section style={S.card}
          data-testid="orgOnboardingImport-step-preview-card">
          <div style={S.cardTitle}>
            {tSafe('orgOnboardingImport.previewTitle', 'Preview')}
          </div>
          <div style={S.cardBody}>
            {tSafe('orgOnboardingImport.previewBody',
              'Rows are bucketed by validation outcome. Review '
              + 'each bucket below.')}
          </div>

          <div style={S.bucketRow}>
            <div style={S.bucket}
              data-testid="orgOnboardingImport-bucket-valid">
              <div style={S.bucketCount}>{buckets.valid.length}</div>
              <div style={S.bucketLabel}>
                {tSafe('orgOnboardingImport.bucketValid', 'Valid')}
              </div>
            </div>
            <div style={S.bucket}
              data-testid="orgOnboardingImport-bucket-invalid">
              <div style={S.bucketCount}>{buckets.invalid.length}</div>
              <div style={S.bucketLabel}>
                {tSafe('orgOnboardingImport.bucketInvalid', 'Invalid')}
              </div>
            </div>
            <div style={S.bucket}
              data-testid="orgOnboardingImport-bucket-duplicate">
              <div style={S.bucketCount}>{buckets.duplicate.length}</div>
              <div style={S.bucketLabel}>
                {tSafe('orgOnboardingImport.bucketDuplicate', 'Duplicate')}
              </div>
            </div>
          </div>

          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>
                  {tSafe('orgOnboardingImport.colStatus', 'Status')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingImport.colName', 'Name')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingImport.colDetail', 'Detail')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(['valid', 'invalid', 'duplicate'])
                .flatMap((k) => buckets[k])
                .slice(0, 50)
                .map((r) => {
                  const status = (r && r.status) || 'unknown';
                  const color = ROW_STATUS_COLOR[status] || '#475569';
                  return (
                    <tr key={r.id || r.rowIndex}>
                      <td style={S.td}>{r.rowIndex}</td>
                      <td style={S.td}>
                        <span style={{ ...S.statusPill,
                                       background: color + '22',
                                       color }}>
                          {status}
                        </span>
                      </td>
                      <td style={S.td}>
                        {[r.firstName, r.lastName].filter(Boolean).join(' ')
                          || '—'}
                      </td>
                      <td style={S.td}>
                        {r.errorMessage || r.duplicateReason || ''}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <div style={S.actionsRow}>
            <button type="button" style={S.ctaGhost}
              onClick={() => setStepIndex(0)}
              data-testid="orgOnboardingImport-preview-back">
              {tSafe('orgOnboardingImport.back', 'Back')}
            </button>
            <button type="button" style={S.cta}
              onClick={() => setStepIndex(3)}
              data-testid="orgOnboardingImport-preview-next">
              {tSafe('orgOnboardingImport.previewNext',
                'Resolve duplicates')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 4 — Resolve duplicates */}
      {stepIndex === 3 ? (
        <section style={S.card}
          data-testid="orgOnboardingImport-step-resolve-card">
          <div style={S.cardTitle}>
            {tSafe('orgOnboardingImport.resolveTitle',
              'Resolve duplicates')}
          </div>
          <div style={S.cardBody}>
            {tSafe('orgOnboardingImport.resolveBody',
              'For each duplicate row, decide whether to skip, '
              + 'link to the existing farmer, or review later.')}
          </div>

          {buckets.duplicate.length === 0 ? (
            <div style={S.empty}
              data-testid="orgOnboardingImport-resolve-empty">
              {tSafe('orgOnboardingImport.resolveEmpty',
                'No duplicates detected.')}
            </div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>
                    {tSafe('orgOnboardingImport.colName', 'Name')}
                  </th>
                  <th style={S.th}>
                    {tSafe('orgOnboardingImport.colReason', 'Reason')}
                  </th>
                  <th style={S.th}>
                    {tSafe('orgOnboardingImport.colAction', 'Action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.duplicate.map((r) => {
                  const id = r.id || ('row-' + r.rowIndex);
                  const current = duplicateActions[id];
                  return (
                    <tr key={id}>
                      <td style={S.td}>{r.rowIndex}</td>
                      <td style={S.td}>
                        {[r.firstName, r.lastName].filter(Boolean).join(' ')
                          || '—'}
                      </td>
                      <td style={S.td}>{r.duplicateReason || '—'}</td>
                      <td style={S.td}>
                        <div style={S.inlineActions}>
                          {[
                            ['skip',          'Skip'],
                            ['link',          'Link to existing'],
                            ['review_later',  'Review later'],
                          ].map(([key, label]) => (
                            <button key={key} type="button"
                              style={current === key
                                ? { ...S.miniBtn, ...S.miniBtnActive }
                                : S.miniBtn}
                              onClick={() => onMarkDuplicate(id, key)}
                              data-testid={`orgOnboardingImport-dup-${id}-${key}`}>
                              {tSafe('orgOnboardingImport.dupAction_' + key,
                                label)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={S.actionsRow}>
            <button type="button" style={S.ctaGhost}
              onClick={() => setStepIndex(2)}
              data-testid="orgOnboardingImport-resolve-back">
              {tSafe('orgOnboardingImport.back', 'Back')}
            </button>
            <button type="button" style={S.cta}
              onClick={() => setStepIndex(4)}
              data-testid="orgOnboardingImport-resolve-next">
              {tSafe('orgOnboardingImport.resolveNext', 'Continue')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 5 — Confirm */}
      {stepIndex === 4 ? (
        <section style={S.card}
          data-testid="orgOnboardingImport-step-confirm-card">
          <div style={S.cardTitle}>
            {tSafe('orgOnboardingImport.confirmTitle',
              'Confirm import')}
          </div>
          <div style={S.cardBody}>
            {tSafe('orgOnboardingImport.confirmBody',
              'Review the summary below, then commit the batch. '
              + 'Imports are written to your organization roster.')}
          </div>

          <div style={S.summaryRow}>
            <span>{tSafe('orgOnboardingImport.sumTotal', 'Total rows')}</span>
            <span><strong>{buckets.total}</strong></span>
          </div>
          <div style={S.summaryRow}>
            <span>{tSafe('orgOnboardingImport.sumValid', 'Will import')}</span>
            <span><strong>{buckets.valid.length}</strong></span>
          </div>
          <div style={S.summaryRow}>
            <span>{tSafe('orgOnboardingImport.sumInvalid', 'Will skip — invalid')}</span>
            <span><strong>{buckets.invalid.length}</strong></span>
          </div>
          <div style={S.summaryRow}>
            <span>{tSafe('orgOnboardingImport.sumDuplicate', 'Duplicates flagged')}</span>
            <span><strong>{buckets.duplicate.length}</strong></span>
          </div>

          <div style={S.actionsRow}>
            <button type="button" style={S.ctaGhost}
              onClick={() => setStepIndex(3)}
              disabled={submitting}
              data-testid="orgOnboardingImport-confirm-back">
              {tSafe('orgOnboardingImport.back', 'Back')}
            </button>
            <button type="button" style={S.cta}
              onClick={onConfirmImport}
              disabled={submitting || !!confirmResult || !!confirmFailure}
              data-testid="orgOnboardingImport-confirm-btn">
              {confirmResult
                ? tSafe('orgOnboardingImport.confirmDone', 'Imported')
                : submitting
                  ? tSafe('orgOnboardingImport.confirmLoading',
                      'Committing…')
                  : tSafe('orgOnboardingImport.confirmCta',
                      'Confirm import')}
            </button>
          </div>

          {confirmResult ? (
            <div style={{ marginTop: 14 }}
              data-testid="orgOnboardingImport-result">
              <div style={S.cardTitle}>
                {tSafe('orgOnboardingImport.resultTitle',
                  'Import result')}
              </div>
              <div style={S.summaryRow}>
                <span>{tSafe('orgOnboardingImport.resultImported',
                  'Imported')}</span>
                <span><strong>{confirmResult.imported}</strong></span>
              </div>
              <div style={S.summaryRow}>
                <span>{tSafe('orgOnboardingImport.resultFailed',
                  'Failed')}</span>
                <span><strong>{confirmResult.failed}</strong></span>
              </div>
              <div style={S.summaryRow}>
                <span>{tSafe('orgOnboardingImport.resultSkipped',
                  'Skipped')}</span>
                <span><strong>{confirmResult.skipped}</strong></span>
              </div>
            </div>
          ) : null}

          {confirmFailure ? (
            <div style={{ marginTop: 14,
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          borderRadius: 10,
                          padding: '12px 14px' }}
              data-testid="orgOnboardingImport-failure">
              <div style={{ ...S.cardTitle, color: '#B91C1C' }}
                data-testid="orgOnboardingImport-failure-title">
                {confirmFailure.title}
              </div>
              <div style={{ ...S.cardBody, color: '#1F2933' }}
                data-testid="orgOnboardingImport-failure-body">
                {confirmFailure.body}
              </div>
              <div style={S.actionsRow}>
                <button type="button" style={S.cta}
                  onClick={onRetryImport}
                  disabled={submitting}
                  data-testid="orgOnboardingImport-failure-retry">
                  {tSafe('orgOnboardingImport.retryImport',
                    'Retry Import')}
                </button>
                <button type="button" style={S.ctaGhost}
                  onClick={onDownloadErrorRows}
                  data-testid="orgOnboardingImport-failure-download">
                  {tSafe('orgOnboardingImport.downloadErrorRows',
                    'Download Error Rows')}
                </button>
                <button type="button" style={S.ctaGhost}
                  onClick={onBackToBatches}
                  data-testid="orgOnboardingImport-failure-back-to-batches">
                  {tSafe('orgOnboardingImport.backToBatches',
                    'Back to Batches')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
