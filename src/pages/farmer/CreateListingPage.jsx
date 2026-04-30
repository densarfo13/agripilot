/**
 * CreateListingPage — lean "publish your harvest" form.
 *
 * Two entry points:
 *   - fresh create: route state is empty, all fields blank
 *   - post-harvest pre-fill: route state carries { cycleId, prefill }
 *     (from PostHarvestSummaryPage's "Sell this harvest?" flow); the
 *     page calls /api/listings/from-harvest to create a draft, and
 *     presents the editable form on top of the server's pre-fill.
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { createListing, createListingFromHarvest, updateListing } from '../../hooks/useMarket.js';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { tSafe } from '../../i18n/tSafe.js';

const UNITS = ['kg', 'lb', 'bag', 'crate', 'bushel'];
const QUALITIES = ['high', 'medium', 'low'];
const PRICING = ['fixed', 'negotiable', 'ask_buyer'];
const DELIVERY = ['pickup', 'delivery', 'either'];

export default function CreateListingPage() {
  const { t, language, region } = useAppSettings();
  const navigate = useNavigate();
  const routeState = useLocation().state || {};
  const prefill = routeState.prefill || {};
  const cycleId = routeState.cycleId || null;

  const [form, setForm] = useState({
    cropKey: prefill.cropKey || '',
    quantity: prefill.quantity || '',
    unit: prefill.unit || 'kg',
    quality: prefill.quality || 'medium',
    country: prefill.country || region?.country || 'US',
    stateCode: prefill.stateCode || region?.stateCode || '',
    city: prefill.city || region?.city || '',
    price: prefill.price || '',
    pricingMode: prefill.pricingMode || 'negotiable',
    deliveryMode: prefill.deliveryMode || 'either',
    notes: prefill.notes || '',
    status: 'active',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 0,
      price: form.price ? Number(form.price) : null,
    };
    try {
      if (cycleId) {
        // Use the pre-fill endpoint first, then patch farmer edits on
        // top so we never lose the cycle link.
        const { listing } = await createListingFromHarvest(cycleId, payload);
        if (form.status === 'active' && listing?.id && listing.status !== 'active') {
          await updateListing(listing.id, { ...payload, status: 'active' });
        }
      } else {
        await createListing(payload);
      }
      navigate('/farmer/listings');
    } catch (e2) {
      setErr(e2?.code || 'error');
    } finally {
      setBusy(false);
    }
  }

  const cropLabel = form.cropKey
    ? getCropDisplayName(form.cropKey, language, { bilingual: 'auto' })
    : '';

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{tSafe('market.create.title', '')}</h1>
        {cropLabel && (
          <p style={S.subtitle}>
            {t('market.create.for', { crop: cropLabel }) || `For ${cropLabel}`}
          </p>
        )}

        <form onSubmit={handleSubmit} style={S.form}>
          <Field label={tSafe('market.field.crop', '')}>
            {/* Bind the displayed value to the localised cropLabel
                (computed at line ~77 via getCropDisplayName) when
                the prefilled cropKey resolves; falls back to the
                raw form.cropKey for free-text typing. Without this,
                legacy uppercase canonical codes like "ALMOND"
                rendered as-is in non-en UIs. */}
            <input
              required
              value={cropLabel || form.cropKey}
              onChange={set('cropKey')}
              placeholder="tomato"
              style={S.input}
            />
          </Field>

          <div style={S.row}>
            <Field label={tSafe('market.field.quantity', '')} flex={2}>
              <input
                required type="number" min="0" step="0.1"
                value={form.quantity} onChange={set('quantity')}
                style={S.input}
              />
            </Field>
            <Field label={tSafe('market.field.unit', '')} flex={1}>
              <select value={form.unit} onChange={set('unit')} style={S.select}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{t(`harvest.unit.${u}`) || u}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={tSafe('market.field.quality', '')}>
            <div style={S.chipRow}>
              {QUALITIES.map((q) => {
                const active = form.quality === q;
                return (
                  <button key={q} type="button"
                    onClick={() => setForm((s) => ({ ...s, quality: q }))}
                    style={{ ...S.chip, ...(active ? S.chipActive : null) }}
                    data-testid={`quality-${q}`}
                  >
                    {t(`market.quality.${q}`) || q}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={S.row}>
            <Field label={tSafe('market.field.price', '')} flex={2}>
              <input
                type="number" min="0" step="0.01"
                value={form.price} onChange={set('price')}
                style={S.input}
              />
            </Field>
            <Field label={tSafe('market.field.pricingMode', '')} flex={2}>
              <select value={form.pricingMode} onChange={set('pricingMode')} style={S.select}>
                {PRICING.map((p) => (
                  <option key={p} value={p}>{t(`market.pricingMode.${p}`) || p}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={tSafe('market.field.deliveryMode', '')}>
            <div style={S.chipRow}>
              {DELIVERY.map((d) => {
                const active = form.deliveryMode === d;
                return (
                  <button key={d} type="button"
                    onClick={() => setForm((s) => ({ ...s, deliveryMode: d }))}
                    style={{ ...S.chip, ...(active ? S.chipActive : null) }}
                  >
                    {t(`market.delivery.${d}`) || d}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={tSafe('market.field.notes', '')}>
            <textarea
              value={form.notes} onChange={set('notes')}
              maxLength={800} rows={3}
              style={S.textarea}
            />
          </Field>

          {err && <p style={S.err}>{t(`market.err.${err}`) || tSafe('issue.err.generic', '')}</p>}

          <div style={S.ctaRow}>
            <button type="button" onClick={() => navigate(-1)} style={S.btnGhost}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy} style={S.btnPrimary}>
              {busy ? t('common.saving') : (tSafe('market.create.submit', ''))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, flex }) {
  return (
    <label style={{ ...S.field, ...(flex ? { flex } : {}) }}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '32rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: { fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600 },
  input: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '1rem',
  },
  select: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem',
  },
  textarea: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', resize: 'vertical',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  chip: {
    padding: '0.5rem 0.75rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', minHeight: '40px',
  },
  chipActive: { borderColor: '#22C55E', background: 'rgba(34,197,94,0.14)', color: '#22C55E' },
  err: { color: '#FCA5A5', fontSize: '0.8125rem', margin: 0 },
  ctaRow: { display: 'flex', gap: '0.5rem', marginTop: '0.25rem' },
  btnGhost: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', minHeight: '52px',
  },
  btnPrimary: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
  },
};
