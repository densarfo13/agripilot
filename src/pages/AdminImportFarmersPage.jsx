/**
 * AdminImportFarmersPage — NGO/partner farmer CSV import flow.
 *
 * 5 phases (spec §4):
 *   A. entry      — upload + template download
 *   B. validating — spinner while preview runs
 *   C. preview    — counts + per-row table + status badges
 *   D. confirm    — running executeFarmerImport
 *   E. result     — summary + export errors + done
 *
 * All copy is localized. The actual API save is wired through api.js —
 * existing farmer-write endpoints persist the rows.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { previewFarmerImport } from '../services/import/previewFarmerImport.js';
import { executeFarmerImport, IMPORT_MODES } from '../services/import/executeFarmerImport.js';
import { downloadTemplate, downloadErrorsCsv } from '../services/import/importTemplate.js';
import api from '../api/client.js';

const PHASE = { ENTRY: 'entry', VALIDATING: 'validating', PREVIEW: 'preview', CONFIRMING: 'confirming', RESULT: 'result' };

const STATUS_COLORS = {
  NEW: '#22C55E',
  UPDATE_EXISTING: '#3B82F6',
  DUPLICATE_IN_FILE: '#F59E0B',
  INVALID: '#EF4444',
};

// ─── Save adapter ─────────────────────────────────────────
// Wraps the existing farmer-write API so the import orchestrator stays
// decoupled from transport details. A future API-ingestion path can
// supply its own adapter (queue-backed, batch, etc.) without touching
// executeFarmerImport.
async function saveFarmerAdapter({ mode, payload }) {
  try {
    if (mode === 'create') {
      const res = await api.post('/api/v2/farmers/partner-import', payload);
      return { ok: true, id: res?.data?.id || res?.data?.farmerId };
    }
    if (mode === 'update') {
      const res = await api.patch(`/api/v2/farmers/${payload.id}/partner-import`, payload);
      return { ok: true, id: payload.id, result: res?.data };
    }
  } catch (err) {
    return { ok: false, error: err?.response?.data?.message || err?.message || 'save_failed' };
  }
  return { ok: false, error: 'unknown_mode' };
}

export default function AdminImportFarmersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [phase, setPhase] = useState(PHASE.ENTRY);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState(IMPORT_MODES.CREATE_AND_UPDATE);
  const [organizationId, setOrganizationId] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function resetFlow() {
    setPhase(PHASE.ENTRY);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function handleFilePicked(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setError('');
    setPhase(PHASE.VALIDATING);
    safeTrackEvent('import.file_picked', { size: picked.size, name: picked.name });

    try {
      const res = await previewFarmerImport(picked, { organizationId });
      setPreview(res);
      setPhase(PHASE.PREVIEW);
      safeTrackEvent('import.preview_ready', { total: res.counts.total, ...res.counts });
    } catch (err) {
      setError(err.message || 'import.error.generic');
      setPhase(PHASE.ENTRY);
      safeTrackEvent('import.preview_failed', { message: err?.message });
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setPhase(PHASE.CONFIRMING);
    setError('');
    try {
      const res = await executeFarmerImport(preview.results, {
        mode,
        organizationId,
        uploadedBy: user?.id || '',
        fileName: preview.file?.name || '',
        saveFarmer: saveFarmerAdapter,
      });
      setResult(res);
      setPhase(PHASE.RESULT);
    } catch (err) {
      setError(err.message || 'import.error.generic');
      setPhase(PHASE.PREVIEW);
    }
  }

  function exportErrors() {
    if (!preview) return;
    const ok = downloadErrorsCsv(preview.results, 'farmer-import-errors.csv');
    if (!ok) setError('import.error.noErrorsToExport');
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate('/')} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>
        <h1 style={S.title}>{t('import.title')}</h1>
        <p style={S.subtitle}>{t('import.subtitle')}</p>

        {error && <div style={S.errorBox}>{t(error) || error}</div>}

        {phase === PHASE.ENTRY && (
          <EntryPhase
            t={t}
            organizationId={organizationId}
            onOrgChange={setOrganizationId}
            mode={mode}
            onModeChange={setMode}
            onFilePicked={handleFilePicked}
          />
        )}

        {phase === PHASE.VALIDATING && (
          <LoadingPhase t={t} label={t('import.validating')} />
        )}

        {phase === PHASE.PREVIEW && preview && (
          <PreviewPhase
            t={t}
            preview={preview}
            onCancel={resetFlow}
            onConfirm={handleConfirm}
            onExportErrors={exportErrors}
          />
        )}

        {phase === PHASE.CONFIRMING && (
          <LoadingPhase t={t} label={t('import.importing')} />
        )}

        {phase === PHASE.RESULT && result && (
          <ResultPhase t={t} result={result} onDone={resetFlow} />
        )}
      </div>
    </div>
  );
}

// ─── Phase A: Entry ────────────────────────────────────────
function EntryPhase({ t, organizationId, onOrgChange, mode, onModeChange, onFilePicked }) {
  return (
    <div style={S.card}>
      <h2 style={S.h2}>{t('import.entry.title')}</h2>
      <p style={S.muted}>{t('import.entry.body')}</p>

      <label style={S.label}>{t('import.entry.organizationId')}</label>
      <input
        type="text"
        value={organizationId}
        onChange={(e) => onOrgChange(e.target.value)}
        placeholder={t('import.entry.organizationIdHint')}
        style={S.input}
      />

      <label style={{ ...S.label, marginTop: '1rem' }}>{t('import.entry.mode')}</label>
      <div style={S.radioGroup}>
        <label style={S.radioRow}>
          <input
            type="radio" name="mode"
            checked={mode === IMPORT_MODES.CREATE_AND_UPDATE}
            onChange={() => onModeChange(IMPORT_MODES.CREATE_AND_UPDATE)}
          />
          <span>{t('import.entry.modeCreateUpdate')}</span>
        </label>
        <label style={S.radioRow}>
          <input
            type="radio" name="mode"
            checked={mode === IMPORT_MODES.CREATE_ONLY}
            onChange={() => onModeChange(IMPORT_MODES.CREATE_ONLY)}
          />
          <span>{t('import.entry.modeCreateOnly')}</span>
        </label>
      </div>

      <div style={S.uploadRow}>
        <button type="button" onClick={() => downloadTemplate()} style={S.templateBtn}>
          {'\u2B07\uFE0F'} {t('import.entry.downloadTemplate')}
        </button>
        <label style={S.uploadBtn}>
          {'\uD83D\uDCE4'} {t('import.entry.uploadFile')}
          <input
            type="file"
            accept=".csv,.tsv,.xlsx,.xls"
            onChange={onFilePicked}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <p style={S.mutedSmall}>{t('import.entry.formatHint')}</p>
    </div>
  );
}

// ─── Phase: Loading ────────────────────────────────────────
function LoadingPhase({ t, label }) {
  return (
    <div style={S.card}>
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <span style={S.loadingLabel}>{label}</span>
      </div>
    </div>
  );
}

// ─── Phase C: Preview ─────────────────────────────────────
function PreviewPhase({ t, preview, onCancel, onConfirm, onExportErrors }) {
  const c = preview.counts;
  const importable = c.newCount + c.updateCount;
  return (
    <>
      <div style={S.card}>
        <h2 style={S.h2}>{t('import.preview.title')}</h2>
        <div style={S.countsGrid}>
          <CountTile label={t('import.preview.total')} value={c.total} color="#EAF2FF" />
          <CountTile label={t('import.preview.newCount')} value={c.newCount} color={STATUS_COLORS.NEW} />
          <CountTile label={t('import.preview.updateCount')} value={c.updateCount} color={STATUS_COLORS.UPDATE_EXISTING} />
          <CountTile label={t('import.preview.duplicateInFile')} value={c.duplicateInFile} color={STATUS_COLORS.DUPLICATE_IN_FILE} />
          <CountTile label={t('import.preview.invalid')} value={c.invalid} color={STATUS_COLORS.INVALID} />
          <CountTile label={t('import.preview.warnings')} value={c.warnings} color="#F59E0B" />
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>{t('import.preview.tableTitle')}</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>{t('import.preview.col.row')}</th>
                <th style={S.th}>{t('import.preview.col.name')}</th>
                <th style={S.th}>{t('import.preview.col.phone')}</th>
                <th style={S.th}>{t('import.preview.col.location')}</th>
                <th style={S.th}>{t('import.preview.col.crop')}</th>
                <th style={S.th}>{t('import.preview.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.results.slice(0, 100).map((r) => (
                <tr key={r.row._rowNumber}>
                  <td style={S.td}>{r.row._rowNumber}</td>
                  <td style={S.td}>{r.row.full_name || '—'}</td>
                  <td style={S.td}>{r.row.phone_number || '—'}</td>
                  <td style={S.td}>{[r.row.region_or_state, r.row.country].filter(Boolean).join(', ') || '—'}</td>
                  <td style={S.td}>{r.row.crop || '—'}</td>
                  <td style={{ ...S.td, color: STATUS_COLORS[r.importStatus] || '#9FB3C8', fontWeight: 700 }}>
                    {t(`import.status.${r.importStatus.toLowerCase()}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.results.length > 100 && (
            <p style={S.mutedSmall}>{t('import.preview.truncated', { shown: 100, total: preview.results.length })}</p>
          )}
        </div>
      </div>

      <div style={S.actionRow}>
        <button type="button" onClick={onCancel} style={S.secondaryBtn}>{t('common.cancel')}</button>
        <button type="button" onClick={onExportErrors} style={S.secondaryBtn}>{t('import.preview.exportErrors')}</button>
        <button type="button" onClick={onConfirm} disabled={importable === 0} style={{ ...S.primaryBtn, ...(importable === 0 ? S.disabled : {}) }}>
          {t('import.preview.confirm', { count: importable })}
        </button>
      </div>
    </>
  );
}

function CountTile({ label, value, color }) {
  return (
    <div style={S.countTile}>
      <div style={{ ...S.countValue, color }}>{value}</div>
      <div style={S.countLabel}>{label}</div>
    </div>
  );
}

// ─── Phase E: Result ──────────────────────────────────────
function ResultPhase({ t, result, onDone }) {
  const s = result.summary;
  return (
    <>
      <div style={S.card}>
        <h2 style={S.h2}>{t('import.result.title')}</h2>
        <div style={S.countsGrid}>
          <CountTile label={t('import.result.created')} value={s.created} color={STATUS_COLORS.NEW} />
          <CountTile label={t('import.result.updated')} value={s.updated} color={STATUS_COLORS.UPDATE_EXISTING} />
          <CountTile label={t('import.result.skipped')} value={s.skipped} color={STATUS_COLORS.DUPLICATE_IN_FILE} />
          <CountTile label={t('import.result.invalid')} value={s.invalid} color={STATUS_COLORS.INVALID} />
        </div>
        <p style={S.mutedSmall}>
          {t('import.result.batchId', { id: result.batch.id })}
        </p>
      </div>

      {result.errors.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>{t('import.result.errorsTitle')}</h3>
          <ul style={S.errorList}>
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i} style={S.errorItem}>
                <span style={S.errorRow}>{t('import.result.rowLabel')} {e.rowNumber}</span>
                <span style={S.errorMsg}>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={S.actionRow}>
        <button type="button" onClick={onDone} style={S.primaryBtn}>{t('import.result.done')}</button>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', color: '#EAF2FF', padding: '1rem 0 3rem' },
  container: { maxWidth: '64rem', margin: '0 auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  backBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', padding: '0.25rem 0' },
  title: { fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  subtitle: { fontSize: '0.9375rem', color: '#9FB3C8', margin: 0 },
  card: { borderRadius: '18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  h2: { fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  h3: { fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  muted: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
  mutedSmall: { fontSize: '0.75rem', color: '#6F8299', margin: '0.25rem 0 0' },
  label: { fontSize: '0.75rem', fontWeight: 700, color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', outline: 'none' },
  radioGroup: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#EAF2FF', cursor: 'pointer' },
  uploadRow: { display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' },
  templateBtn: { padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' },
  uploadBtn: { padding: '0.75rem 1rem', borderRadius: '12px', border: 'none', background: '#22C55E', color: '#fff', fontSize: '0.875rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  errorBox: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem' },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem' },
  spinner: { width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' },
  loadingLabel: { fontSize: '0.9375rem', color: '#9FB3C8', fontWeight: 600 },
  countsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' },
  countTile: { padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' },
  countValue: { fontSize: '1.375rem', fontWeight: 800, lineHeight: 1.1 },
  countLabel: { fontSize: '0.6875rem', fontWeight: 700, color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' },
  tableWrap: { overflow: 'auto', maxHeight: '28rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' },
  th: { textAlign: 'left', padding: '0.625rem 0.875rem', fontWeight: 800, color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.18)', position: 'sticky', top: 0 },
  td: { padding: '0.5rem 0.875rem', color: '#EAF2FF', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  actionRow: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' },
  primaryBtn: { padding: '0.875rem 1.25rem', borderRadius: '14px', background: '#22C55E', color: '#fff', border: 'none', fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer', minHeight: '48px', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  secondaryBtn: { padding: '0.875rem 1.25rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px' },
  disabled: { opacity: 0.4, cursor: 'not-allowed' },
  errorList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  errorItem: { display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', color: '#FCA5A5' },
  errorRow: { fontWeight: 700, minWidth: '5rem' },
  errorMsg: { fontWeight: 500, color: '#EAF2FF' },
};
