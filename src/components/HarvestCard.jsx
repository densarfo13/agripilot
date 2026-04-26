/**
 * HarvestCard — single-card UI that handles the three harvest
 * states the cycle engine can return:
 *
 *   • active             → hidden (no card, nothing urgent)
 *   • harvest_ready      → "Ready to harvest" prompt + amount form
 *   • completed          → summary with value estimate + next step
 *
 * Mobile-first, matches the existing Farroway card style. All the
 * hard work lives in the engines; this component is mostly glue.
 */

import { useMemo, useState } from 'react';
// Strict no-leak alias — see useStrictTranslation.js.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getCropCycleState } from '../lib/harvest/cropCycleCompletionEngine.js';
import { getHarvestSummary } from '../lib/harvest/harvestSummaryEngine.js';
import {
  recordHarvest, getLatestHarvest, HARVEST_UNITS,
} from '../lib/harvest/harvestRecordStore.js';
import { updateFarm } from '../lib/api.js';
import { safeAction } from '../offline/syncManager.js';

function normaliseFarm(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return {
    id:                   farm.id || farm._id || null,
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    crop:                 farm.crop || null,
    cropStage:            farm.cropStage || farm.stage || null,
    plantingDate:         farm.plantingDate || null,
    manualStageOverride:  farm.manualStageOverride || null,
    countryCode:          farm.countryCode || farm.country || null,
    farmType:             farm.farmType || 'small_farm',
  };
}

export default function HarvestCard({ farm, onRecorded = null } = {}) {
  const { t } = useTranslation();
  const mapped = useMemo(() => normaliseFarm(farm), [farm]);
  const [tick, setTick] = useState(0);   // bump to re-read after save

  const view = useMemo(() => {
    if (!mapped) return null;
    const cycle = getCropCycleState({ farm: mapped });
    const latest = mapped.id ? getLatestHarvest(mapped.id) : null;
    const summary = latest ? getHarvestSummary({ record: latest, farm: mapped }) : null;
    return { cycle, latest, summary };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, tick]);

  // ─── Local form state for the capture flow ─────────────────
  const [amount, setAmount] = useState('');
  const [unit,   setUnit]   = useState('kg');
  const [notes,  setNotes]  = useState('');
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  if (!view || !mapped) return null;
  const { cycle, summary } = view;

  if (cycle.state === 'active') return null;   // nothing urgent yet

  // ─── Completed — show the summary ──────────────────────────
  if (cycle.state === 'completed' && summary) {
    return (
      <div style={S.wrap} data-testid="harvest-summary-card">
        <div style={S.headerRow}>
          <div style={S.title}>
            {t(summary.headline.key) !== summary.headline.key
              ? t(summary.headline.key) : summary.headline.fallback}
          </div>
          <span style={S.doneBadge}>
            {t('harvest.badge.completed') !== 'harvest.badge.completed'
              ? t('harvest.badge.completed') : 'Cycle complete'}
          </span>
        </div>
        <div style={S.bigNumber} data-testid="harvest-amount">
          {`${summary.harvestedAmount} ${unitLabel(t, summary.harvestedUnit)}`}
        </div>
        {summary.valueEstimate && (
          <div style={S.valueRow} data-testid="harvest-value">
            {`${summary.valueEstimate.formatted.low} \u2013 ${summary.valueEstimate.formatted.high}`}
            <span style={S.approxNote}>
              {' '}
              {t('harvest.summary.approx') !== 'harvest.summary.approx'
                ? t('harvest.summary.approx')
                : '(estimated value)'}
            </span>
          </div>
        )}
        <div style={S.nextStep}>
          → {t(summary.nextStepKey) !== summary.nextStepKey
              ? t(summary.nextStepKey) : summary.nextStepFallback}
        </div>
      </div>
    );
  }

  // ─── Harvest-ready — show the capture form ─────────────────
  const tone = 'ready';
  const headline = (cycle.harvestState && cycle.harvestState.daysPastExpectedHarvest > 0)
    ? (t('harvest.ready.headlineLate') !== 'harvest.ready.headlineLate'
        ? t('harvest.ready.headlineLate')
        : `Your crop is likely past its expected harvest by ${cycle.harvestState.daysPastExpectedHarvest} days.`)
    : (t('harvest.ready.headline') !== 'harvest.ready.headline'
        ? t('harvest.ready.headline')
        : 'Your crop is ready for harvest.');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError(t('harvest.err.amount') !== 'harvest.err.amount'
        ? t('harvest.err.amount')
        : 'Enter how much you harvested.');
      return;
    }
    setSaving(true);
    try {
      const record = recordHarvest({
        farmId:          mapped.id,
        crop:            mapped.crop,
        harvestedAmount: amt,
        harvestedUnit:   unit,
        notes:           notes || null,
        plantingDate:    mapped.plantingDate || null,
      });
      if (!record) {
        setError(t('harvest.err.save') !== 'harvest.err.save'
          ? t('harvest.err.save')
          : 'Could not save the record. Please try again.');
        return;
      }
      // P4.12 — Reset manualStageOverride after harvest completes so
      // the next cycle flows through the computed timeline cleanly.
      // Override leaks across cycles otherwise (the engine keeps the
      // pinned stage forever even after a new plantingDate is set).
      // Fire-and-forget; failure here must NOT block the local
      // record being saved (the farmer already sees the success UI).
      //
      // Additive offline-safety: route through `safeAction` so an
      // offline tap queues the override-reset for the next online
      // sync tick (App.jsx auto-flushes every 5s) instead of being
      // silently lost in the existing `.catch(() => {})`.
      if (mapped.id && mapped.manualStageOverride) {
        try {
          safeAction(
            {
              type: 'farm_update',
              payload: { farmId: mapped.id, payload: { manualStageOverride: null } },
            },
            (a) => updateFarm(a.payload.farmId, a.payload.payload).catch(() => {}),
          );
        } catch { /* never throw from here */ }
      }
      setAmount(''); setNotes('');
      setTick((n) => n + 1);
      if (typeof onRecorded === 'function') onRecorded(record);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...S.wrap, ...S.readyTone }} data-testid="harvest-capture-card">
      <div style={S.headerRow}>
        <div style={S.title}>
          {t('harvest.ready.title') !== 'harvest.ready.title'
            ? t('harvest.ready.title') : 'Time to harvest'}
        </div>
        <span style={S.readyBadge}>
          {t('harvest.badge.ready') !== 'harvest.badge.ready'
            ? t('harvest.badge.ready') : 'Harvest-ready'}
        </span>
      </div>
      <p style={S.body}>{headline}</p>

      <form onSubmit={onSubmit} style={S.form} noValidate>
        <div style={S.row}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('harvest.form.amount') !== 'harvest.form.amount'
              ? t('harvest.form.amount') : 'Amount'}
            style={S.input}
            disabled={saving}
            data-testid="harvest-amount-input"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={S.select}
            disabled={saving}
            data-testid="harvest-unit-select"
          >
            {HARVEST_UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {unitLabel(t, u.key)}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('harvest.form.notes') !== 'harvest.form.notes'
            ? t('harvest.form.notes') : 'Notes (optional)'}
          style={S.input}
          disabled={saving}
          data-testid="harvest-notes-input"
        />
        {error && <div style={S.error} role="alert">{error}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{ ...S.cta, ...(saving ? S.ctaDisabled : null) }}
          data-testid="harvest-save"
        >
          {saving
            ? (t('harvest.form.saving') !== 'harvest.form.saving'
                ? t('harvest.form.saving') : 'Saving\u2026')
            : (t('harvest.form.save') !== 'harvest.form.save'
                ? t('harvest.form.save') : 'Record harvest')}
        </button>
      </form>

      <div style={S.whyHint}>
        {t('harvest.ready.why') !== 'harvest.ready.why'
          ? t('harvest.ready.why')
          : 'Recording the amount completes this crop cycle and unlocks your next planting plan.'}
      </div>
      {/* tone marker keeps the lint from flagging the unused var */}
      <span hidden data-tone={tone} />
    </div>
  );
}

function unitLabel(t, key) {
  const row = HARVEST_UNITS.find((u) => u.key === key);
  if (!row) return key;
  return t(row.labelKey) !== row.labelKey ? t(row.labelKey) : row.fallback;
}

const S = {
  wrap: {
    width: '100%', background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1rem 1.125rem',
    marginTop: '1rem',
    color: '#fff',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
  },
  readyTone:   {
    background: 'rgba(134,239,172,0.06)',
    border: '1px solid rgba(134,239,172,0.35)',
  },
  headerRow:   { display: 'flex', alignItems: 'center',
                 justifyContent: 'space-between', gap: '0.5rem' },
  title:       { fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },
  body:        { fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)',
                 margin: 0, lineHeight: 1.45 },
  form:        { display: 'flex', flexDirection: 'column', gap: '0.5rem',
                 marginTop: '0.25rem' },
  row:         { display: 'flex', gap: '0.5rem' },
  input: {
    flex: 1, minWidth: 0,
    padding: '0.75rem 0.875rem', fontSize: '0.9375rem',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)',
    background: '#0B1525', color: '#E2E8F0',
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    padding: '0.75rem 0.75rem', fontSize: '0.9375rem',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)',
    background: '#0B1525', color: '#E2E8F0',
    colorScheme: 'dark',
  },
  cta: {
    background: '#22C55E', color: '#000', border: 'none',
    borderRadius: '12px', padding: '0.75rem 1rem',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    minHeight: '2.75rem',
  },
  ctaDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: {
    fontSize: '0.8125rem', color: '#FCA5A5',
    background: 'rgba(252,165,165,0.08)',
    border: '1px solid rgba(252,165,165,0.3)',
    borderRadius: '10px', padding: '0.5rem 0.625rem',
  },
  whyHint: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
             lineHeight: 1.4 },
  readyBadge: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#86EFAC',
    border: '1px solid rgba(134,239,172,0.35)',
    background: 'rgba(134,239,172,0.06)',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  doneBadge: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#BFDBFE',
    border: '1px solid rgba(147,197,253,0.3)',
    background: 'rgba(147,197,253,0.08)',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  bigNumber: { fontSize: '1.5rem', fontWeight: 800, color: '#F8FAFC' },
  valueRow: { fontSize: '0.9375rem', color: '#86EFAC', fontWeight: 700 },
  approxNote: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
                fontWeight: 400 },
  nextStep: { fontSize: '0.875rem', color: '#F8FAFC', lineHeight: 1.4 },
};
