/**
 * AddFarmerForm — onboarding form an agent uses to add a
 * farmer in the field. Designed for low-connectivity use:
 * the form succeeds offline and the action queues for
 * sync.
 *
 * Spec contract (Field Agent Mode, § 3)
 *   Fields: name, phone, crop, farm size, region, GPS (auto)
 *   Behaviour: queues an ADD_FARMER action via agentQueue;
 *              never blocks when GPS denies / times out.
 *
 * Strict-rule audit
 *   * Local-first — addToQueue persists synchronously, so
 *     the agent sees the new farmer in their list even on
 *     a plane.
 *   * GPS auto-read is OPTIONAL. If permission is denied
 *     or the request times out, the form still saves at
 *     a lower verification level.
 *   * Never shows raw API errors — sync failures live in
 *     the queue and are handled by the AgentDashboard.
 *   * No sensitive document upload — name + phone +
 *     simple metadata only, per the verification spec.
 */

import React, { useEffect, useState } from 'react';
import { addToQueue, AGENT_ACTIONS } from '../../offline/agentQueue.js';
import { tryReadGeolocation } from '../../verification/verificationStore.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

const EMPTY = Object.freeze({
  name: '', phone: '', crop: '', farmSize: '', region: '',
});

export default function AddFarmerForm({
  agentId,                              // current user id
  onAdded,                              // callback after successful queue
  testId = 'add-farmer-form',
}) {
  const [form, setForm]   = useState(EMPTY);
  const [gps, setGps]     = useState(null);
  const [gpsState, setGpsState] = useState('idle'); // idle | busy | done | denied
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [flash,  setFlash]  = useState('');

  // Auto-read GPS on mount — best-effort, never blocks the
  // form. If denied, gps stays null and the form still
  // submits at a lower level.
  useEffect(() => {
    let alive = true;
    setGpsState('busy');
    tryReadGeolocation(4000).then((p) => {
      if (!alive) return;
      if (p) {
        setGps(p);
        setGpsState('done');
      } else {
        setGpsState('denied');
      }
    });
    return () => { alive = false; };
  }, []);

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setErrMsg('');
    if (submitting) return;

    if (!String(form.name).trim()) {
      setErrMsg(tSafe('agent.error.nameRequired',
        'Please enter the farmer\u2019s name.'));
      return;
    }
    if (!String(form.phone).trim()) {
      setErrMsg(tSafe('agent.error.phoneRequired',
        'Please enter the farmer\u2019s phone number.'));
      return;
    }

    setSubmitting(true);
    try {
      addToQueue({
        action:  AGENT_ACTIONS.ADD_FARMER,
        agentId: agentId || null,
        payload: {
          name:     form.name,
          phone:    form.phone,
          crop:     form.crop,
          farmSize: form.farmSize !== '' ? Number(form.farmSize) : null,
          region:   form.region,
          gps:      gps || null,
        },
      });
      setFlash(tSafe('agent.farmerSaved',
        'Farmer saved. Will sync when online.'));
      setForm(EMPTY);
      // Reset GPS so the next add re-reads coords (an agent
      // walking between farms gets fresh GPS each save).
      setGps(null);
      setGpsState('idle');
      tryReadGeolocation(4000).then((p) => {
        if (p) { setGps(p); setGpsState('done'); }
        else   { setGpsState('denied'); }
      });
      if (typeof onAdded === 'function') onAdded();
      setTimeout(() => setFlash(''), 3000);
    } catch (err) {
      setErrMsg(tSafe('agent.error.saveFailed',
        'Could not save the farmer. Try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={S.form}
      noValidate
      data-testid={testId}
    >
      <h2 style={S.title}>
        {tSafe('agent.addFarmer', 'Add a farmer')}
      </h2>

      {errMsg && (
        <p style={S.err} role="alert">{errMsg}</p>
      )}
      {flash && (
        <p style={S.flash} role="status" aria-live="polite">{flash}</p>
      )}

      <Field label={tSafe('agent.farmerName', 'Name')}>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Ama Kofi"
          style={S.input}
          data-testid={`${testId}-name`}
          required
        />
      </Field>

      <Field label={tSafe('agent.farmerPhone', 'Phone (with country code)')}>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          placeholder="+233 …"
          style={S.input}
          data-testid={`${testId}-phone`}
          required
        />
      </Field>

      <Field label={tSafe('agent.crop', 'Crop')}>
        <input
          type="text"
          value={form.crop}
          onChange={(e) => setField('crop', e.target.value)}
          placeholder="maize"
          style={S.input}
          data-testid={`${testId}-crop`}
        />
      </Field>

      <div style={S.row}>
        <Field label={tSafe('agent.farmSize', 'Farm size (ha)')} flex={1}>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.farmSize}
            onChange={(e) => setField('farmSize', e.target.value)}
            placeholder="1.5"
            style={S.input}
            data-testid={`${testId}-size`}
          />
        </Field>
        <Field label={tSafe('agent.region', 'Region')} flex={1}>
          <input
            type="text"
            value={form.region}
            onChange={(e) => setField('region', e.target.value)}
            placeholder="Ashanti"
            style={S.input}
            data-testid={`${testId}-region`}
          />
        </Field>
      </div>

      {/* GPS status — never blocks. */}
      <div style={S.gpsRow} data-testid={`${testId}-gps`}>
        <span style={S.gpsIcon} aria-hidden="true">📍</span>
        <span style={S.gpsLabel}>
          {gpsState === 'busy'   && tSafe('agent.gpsBusy',
            'Reading location\u2026')}
          {gpsState === 'done'   && (
            <span style={S.gpsDone}>
              {tSafe('agent.gpsCaptured', 'Location captured')}
              {' '}({gps.lat.toFixed(3)}, {gps.lng.toFixed(3)})
            </span>
          )}
          {gpsState === 'denied' && (
            <span style={S.gpsDenied}>
              {tSafe('agent.gpsDenied',
                'Location not available — that\u2019s OK')}
            </span>
          )}
          {gpsState === 'idle'   && tSafe('agent.gpsIdle',
            'Location pending\u2026')}
        </span>
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{ ...S.btn, opacity: submitting ? 0.7 : 1 }}
        data-testid={`${testId}-submit`}
      >
        {submitting
          ? tSafe('agent.saving', 'Saving\u2026')
          : tSafe('agent.saveFarmer', 'Save Farmer')}
      </button>

      <p style={S.privacy}>
        {tSafe('agent.privacyNote',
          'Farmer details stay on this device until your phone is online. They sync to your organisation\u2019s account.')}
      </p>
    </form>
  );
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
  form: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  title: { margin: 0, fontSize: '1.125rem',
           fontWeight: 800, color: C.white },
  row: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem',
           color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem',
           flex: '1 1 100%' },
  fieldLabel: { fontWeight: 700, color: 'rgba(255,255,255,0.7)' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.65rem 0.8rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  gpsRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
  },
  gpsIcon: { fontSize: '1rem' },
  gpsLabel: { color: 'rgba(255,255,255,0.85)' },
  gpsDone:   { color: C.lightGreen, fontWeight: 700 },
  gpsDenied: { color: '#FCD34D', fontWeight: 700 },
  err: {
    margin: 0, color: '#FCA5A5', fontSize: '0.875rem',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    borderRadius: '8px', padding: '0.5rem 0.75rem',
  },
  flash: {
    margin: 0, color: C.lightGreen,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem', fontWeight: 700,
  },
  btn: {
    padding: '0.85rem 1.4rem', borderRadius: '12px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(34,197,94,0.25)',
  },
  privacy: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem', lineHeight: 1.4,
  },
};
