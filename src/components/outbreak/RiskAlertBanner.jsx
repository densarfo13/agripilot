/**
 * RiskAlertBanner — single-priority risk banner for the farmer.
 *
 *   <RiskAlertBanner farm={farm} cluster={topClusterMatch?} />
 *
 * Reads risks via computeFarmRisks(...) and renders ONLY the
 * highest-priority HIGH-level risk per spec section 7. Returns
 * null when nothing is HIGH so the existing OutbreakAlertBanner
 * (cluster-driven) gets to surface lesser signals on its own.
 *
 * Voice fires once per local day per (farm, kind) so a farmer
 * who refreshes a few times doesn't get repeated speech. The
 * dedupe ledger lives in localStorage; production-quiet, never
 * spams.
 *
 * Strict-rule audit
 *   * works offline - everything is local
 *   * never throws on missing inputs
 *   * priority enforced inside computeFarmRisks - banner just
 *     renders one line
 *   * tSafe for every visible label
 */

import React, { useEffect, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { speak } from '../../core/farroway/voice.js';
import { computeFarmRisks } from '../../outbreak/riskEngine.js';
import { distanceKm } from '../../utils/geo.js';

const VOICE_LEDGER_KEY = 'farroway_risk_voice_ledger';

function _today() { return new Date().toDateString(); }

function _readLedger() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(VOICE_LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _writeLedger(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VOICE_LEDGER_KEY, JSON.stringify(map));
  } catch { /* swallow */ }
}

function _hasFiredVoiceToday(key) {
  const ledger = _readLedger();
  return ledger[key] === _today();
}

function _markVoiceFired(key) {
  const ledger = _readLedger();
  ledger[key] = _today();
  _writeLedger(ledger);
}

export default function RiskAlertBanner({
  farm     = null,
  cluster  = null,
  weather  = null,    // optional: pass WeatherContext.weather here
  onAct    = null,
}) {
  const [hidden, setHidden] = useState(false);

  if (!farm) return null;

  const risks = computeFarmRisks(farm, cluster, weather ? { weather } : undefined);
  if (!risks.top || risks.top.level !== 'HIGH') return null;
  if (hidden) return null;

  const isPest = risks.top.kind === 'pest';
  const titleKey = isPest ? 'risk.pestHigh'    : 'risk.droughtHigh';
  const ctaKey   = isPest ? 'risk.checkNow'    : 'risk.waterNow';
  const titleFb  = isPest
    ? 'Pest risk rising. Check crops now.'
    : 'Dry conditions. Water your crops.';
  const ctaFb    = isPest ? 'Check crop' : 'Water crops';

  // Compute the "within Xkm" hint when both the farm and the
  // cluster have lat/lng. Distance is rounded up so a 24.6km
  // figure renders as "25km" - matches the way farmers think.
  let proximityKm = null;
  if (isPest && cluster
      && Number.isFinite(Number(cluster.lat))
      && Number.isFinite(Number(cluster.lng))
      && farm.location
      && Number.isFinite(Number(farm.location.lat))
      && Number.isFinite(Number(farm.location.lng))) {
    const d = distanceKm(
      { lat: Number(farm.location.lat), lng: Number(farm.location.lng) },
      { lat: Number(cluster.lat),        lng: Number(cluster.lng)        },
    );
    if (Number.isFinite(d)) proximityKm = Math.max(1, Math.ceil(d));
  }

  // ── one-shot voice per (farm, kind, day) ─────────────────────
  const voiceKey = `${farm && farm.id ? farm.id : 'anon'}:${risks.top.kind}`;
  useEffect(() => {
    if (hidden) return;
    if (_hasFiredVoiceToday(voiceKey)) return;
    const msg = tSafe('risk.voice.high',
      'High risk on your farm. Take action today.');
    try { speak(msg); } catch { /* swallow */ }
    _markVoiceFired(voiceKey);
  }, [voiceKey, hidden]);

  function handleAct() {
    setHidden(true);
    if (typeof onAct === 'function') {
      try { onAct(risks.top); }
      catch { /* never propagate */ }
    }
  }

  function handleSpeak() {
    const msg = tSafe('risk.voice.high',
      'High risk on your farm. Take action today.');
    try { speak(msg); } catch { /* swallow */ }
  }

  return (
    <section role="alert" aria-live="polite" data-testid="risk-alert-banner"
             style={{
               ...S.banner,
               ...(isPest ? S.bannerPest : S.bannerDrought),
             }}>
      <span style={S.icon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <div style={S.text}>
        <strong style={S.title}>
          {tSafe(titleKey, titleFb)}
        </strong>
        <span style={S.body}>
          {proximityKm != null
            ? tSafe('risk.pestNearbyKm',
                'Pest activity reported within {km}km. Check your crops today.')
                .replace('{km}', String(proximityKm))
            : tSafe('risk.takeAction',
                'High risk on your farm. Take action today.')}
        </span>
      </div>
      <div style={S.actions}>
        <button type="button" onClick={handleSpeak}
                style={S.voiceBtn}
                aria-label={tSafe('common.listen', 'Listen')}
                data-testid="risk-banner-voice">
          {'\uD83D\uDD0A'}
        </button>
        <button type="button" onClick={handleAct}
                style={S.primaryBtn}
                data-testid="risk-banner-act">
          {tSafe(ctaKey, ctaFb)}
        </button>
        <button type="button" onClick={() => setHidden(true)}
                style={S.dismissBtn}
                aria-label={tSafe('common.dismiss', 'Dismiss')}
                data-testid="risk-banner-dismiss">
          {'\u2715'}
        </button>
      </div>
    </section>
  );
}

const S = {
  banner: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    border: '1px solid',
    color: '#FFFFFF',
    flexWrap: 'wrap',
  },
  bannerPest: {
    background: 'linear-gradient(135deg, rgba(220,38,38,0.20) 0%, rgba(15,32,52,0.92) 100%)',
    borderColor: 'rgba(248,113,113,0.55)',
  },
  bannerDrought: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(15,32,52,0.92) 100%)',
    borderColor: 'rgba(245,158,11,0.55)',
  },
  icon: { fontSize: '1.5rem', flexShrink: 0 },
  text: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  title: { fontSize: '0.9375rem', fontWeight: 800, color: '#FFFFFF' },
  body:  { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.4 },
  actions: { display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 },
  voiceBtn: {
    width: '40px', height: '40px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.9375rem',
  },
  primaryBtn: {
    background: '#22C55E', color: '#fff',
    border: 'none', borderRadius: '12px',
    padding: '0.5rem 0.875rem',
    fontSize: '0.875rem', fontWeight: 800,
    cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  dismissBtn: {
    width: '36px', height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer', fontSize: '0.875rem',
  },
};
