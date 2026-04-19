/**
 * FeedbackModal — single modal component that replaces three
 * window.prompt calls on the Today screen. Three modes:
 *
 *   mode='skip'     { onSubmit({ reason }) }
 *   mode='issue'    { onSubmit({ category, severity, description }) }
 *   mode='harvest'  { onSubmit({ harvestedAt, actualYieldKg, yieldUnit,
 *                                qualityBand, issues, notes }) }
 *
 * Harvest mode is intentionally lean per the post-harvest spec:
 * date → yield + unit → quality (good/average/poor) → multi-select
 * issues → notes. Anything more is a crop-plan concern, not a
 * one-screen capture flow.
 *
 * Fully localized, mobile-first, and accessible (role="dialog",
 * aria-modal, labels wired to inputs). No external form library.
 */
import { useEffect, useRef, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

const ISSUE_CATEGORIES = ['pest', 'disease', 'water', 'soil', 'weather', 'other'];
const SEVERITIES = ['low', 'medium', 'high'];
// Farmer-facing quality vocab stays the 3-band spec set (good /
// average / poor). `average` normalizes to `fair` server-side.
const QUALITY_OPTIONS = ['good', 'average', 'poor'];
const HARVEST_UNITS = ['kg', 'lb', 'crate', 'bushel', 'bag'];
// Post-harvest issue codes — the spec-declared set.
const HARVEST_ISSUES = ['pest', 'drought', 'excess_rain', 'missed_tasks', 'poor_growth', 'other'];

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function FeedbackModal({ open, mode, onClose, onSubmit }) {
  const { t } = useAppSettings();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const firstFieldRef = useRef(null);

  // Reset the form every time the modal is opened or the mode changes.
  useEffect(() => {
    if (open) {
      setForm({});
      setErr(null);
      // autofocus the first input on next tick so the modal is
      // keyboard-ready the moment it appears.
      setTimeout(() => firstFieldRef.current?.focus?.(), 0);
    }
  }, [open, mode]);

  if (!open) return null;

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await onSubmit?.(sanitize(mode, form));
      onClose?.();
    } catch (e2) {
      setErr(e2?.code || 'error');
    } finally {
      setBusy(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget && !busy) onClose?.();
  }

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div
      style={S.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={handleBackdrop}
      data-testid={`feedback-modal-${mode}`}
    >
      <form style={S.sheet} onSubmit={handleSubmit}>
        <h2 id="feedback-modal-title" style={S.title}>
          {t(titleKey(mode))}
        </h2>

        {mode === 'skip' && (
          <Field label={t('actionHome.primary.skipReason')}>
            <textarea
              ref={firstFieldRef}
              value={form.reason || ''}
              onChange={set('reason')}
              maxLength={200}
              rows={3}
              style={S.textarea}
              data-testid="skip-reason"
            />
          </Field>
        )}

        {mode === 'issue' && (
          <>
            <Field label={t('actionHome.issue.categoryPrompt')}>
              <select
                ref={firstFieldRef}
                value={form.category || ''}
                onChange={set('category')}
                style={S.select}
                data-testid="issue-category"
              >
                <option value="">—</option>
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`issue.category.${c}`) || c}</option>
                ))}
              </select>
            </Field>
            <Field label={t('actionHome.issue.severityPrompt')}>
              <select
                value={form.severity || 'medium'}
                onChange={set('severity')}
                style={S.select}
                data-testid="issue-severity"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{t(`issue.severity.${s}`) || s}</option>
                ))}
              </select>
            </Field>
            <Field label={t('actionHome.issue.descriptionPrompt')}>
              <textarea
                value={form.description || ''}
                onChange={set('description')}
                maxLength={500}
                rows={3}
                style={S.textarea}
                data-testid="issue-description"
              />
            </Field>
          </>
        )}

        {mode === 'harvest' && (
          <>
            <Field label={t('actionHome.harvest.datePrompt') || 'Harvest date'}>
              <input
                ref={firstFieldRef}
                type="date"
                value={form.harvestedAt || todayIso()}
                onChange={set('harvestedAt')}
                max={todayIso()}
                style={S.input}
                data-testid="harvest-date"
              />
            </Field>
            <div style={S.inlineRow}>
              <div style={{ ...S.fieldInline, flex: 2 }}>
                <span style={S.label}>{t('actionHome.harvest.yieldPrompt')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={form.actualYieldKg || ''}
                  onChange={set('actualYieldKg')}
                  style={S.input}
                  data-testid="harvest-yield"
                />
              </div>
              <div style={{ ...S.fieldInline, flex: 1 }}>
                <span style={S.label}>{t('actionHome.harvest.unitPrompt') || 'Unit'}</span>
                <select
                  value={form.yieldUnit || 'kg'}
                  onChange={set('yieldUnit')}
                  style={S.select}
                  data-testid="harvest-unit"
                >
                  {HARVEST_UNITS.map((u) => (
                    <option key={u} value={u}>{t(`harvest.unit.${u}`) || u}</option>
                  ))}
                </select>
              </div>
            </div>
            <Field label={t('actionHome.harvest.qualityPrompt')}>
              <div style={S.chipRow} data-testid="harvest-quality">
                {QUALITY_OPTIONS.map((q) => {
                  const active = (form.qualityBand || '') === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, qualityBand: q }))}
                      style={{ ...S.chip, ...(active ? S.chipActive : null) }}
                      data-testid={`harvest-quality-${q}`}
                    >
                      {t(`harvest.quality.${q}`) || q}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t('actionHome.harvest.issuesPrompt') || 'Issues encountered (optional)'}>
              <div style={S.chipRow} data-testid="harvest-issues">
                {HARVEST_ISSUES.map((iss) => {
                  const selected = Array.isArray(form.issues) && form.issues.includes(iss);
                  return (
                    <button
                      key={iss}
                      type="button"
                      onClick={() => setForm((s) => {
                        const cur = Array.isArray(s.issues) ? s.issues : [];
                        const next = cur.includes(iss)
                          ? cur.filter((x) => x !== iss)
                          : [...cur, iss];
                        return { ...s, issues: next };
                      })}
                      style={{ ...S.chip, ...(selected ? S.chipActive : null) }}
                      data-testid={`harvest-issue-${iss}`}
                    >
                      {t(`harvest.issue.${iss}`) || iss}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t('actionHome.harvest.notesPrompt')}>
              <textarea
                value={form.notes || ''}
                onChange={set('notes')}
                maxLength={500}
                rows={2}
                style={S.textarea}
                data-testid="harvest-notes"
              />
            </Field>
          </>
        )}

        {err && <div style={S.err}>{t('issue.err.generic') || 'Something went wrong'}</div>}

        <div style={S.ctaRow}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={S.btnGhost}
            data-testid="feedback-modal-cancel"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={busy}
            style={{ ...S.btnPrimary, ...(busy ? S.btnBusy : null) }}
            data-testid="feedback-modal-submit"
          >
            {busy ? (t('common.saving') || 'Saving…') : (t('common.submit') || 'Submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

function titleKey(mode) {
  if (mode === 'skip')    return 'actionHome.primary.skip';
  if (mode === 'issue')   return 'actionHome.primary.reportIssue';
  if (mode === 'harvest') return 'actionHome.primary.reportHarvest';
  return 'common.submit';
}

function sanitize(mode, form) {
  if (mode === 'harvest') {
    const n = Number(form.actualYieldKg);
    return {
      harvestedAt: form.harvestedAt || todayIso(),
      actualYieldKg: Number.isFinite(n) && n >= 0 ? n : null,
      yieldUnit: form.yieldUnit || 'kg',
      qualityBand: form.qualityBand || null,
      issues: Array.isArray(form.issues) ? form.issues : [],
      notes: form.notes?.trim() || null,
    };
  }
  if (mode === 'issue') {
    return {
      category: form.category || 'other',
      severity: form.severity || 'medium',
      description: form.description?.trim() || '',
    };
  }
  if (mode === 'skip') {
    return { reason: form.reason?.trim() || '' };
  }
  return form;
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 90,
  },
  sheet: {
    width: '100%', maxWidth: '480px',
    background: '#14171f',
    borderRadius: '20px 20px 0 0',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    maxHeight: '90vh', overflowY: 'auto',
    color: '#EAF2FF',
  },
  title: { margin: 0, fontSize: '1.125rem', fontWeight: 700 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: { fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600 },
  input: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '1rem',
  },
  textarea: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '0.9375rem', resize: 'vertical',
  },
  select: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '0.9375rem',
  },
  err: { color: '#FCA5A5', fontSize: '0.8125rem' },
  ctaRow: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  btnGhost: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '52px',
  },
  btnPrimary: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
  },
  btnBusy: { opacity: 0.7, cursor: 'wait' },
  inlineRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-end' },
  fieldInline: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  chip: {
    padding: '0.5rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer',
    minHeight: '40px',
  },
  chipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
    color: '#22C55E',
  },
};
