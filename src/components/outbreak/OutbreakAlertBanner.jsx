/**
 * OutbreakAlertBanner — farmer-side "pest risk near you" banner.
 *
 *   <OutbreakAlertBanner farm={currentFarm} farmerId={userId} />
 *
 * Reads outbreak reports from the local mirror, runs the pure
 * cluster engine, then asks getAlertsForFarm() for the active
 * clusters that match this farm's country + region + crop.
 * Renders the highest-severity match.
 *
 * Voice: tap the speaker button to hear the warning. Auto-play
 * fires AT MOST once per day per cluster, gated by the dedupe
 * ledger in outbreakNotifications.js.
 *
 * Strict-rule audit:
 *   * works offline (mirror + pure engine)
 *   * never crashes on missing inputs
 *   * never auto-plays repeatedly (dedupe per spec)
 *   * cropLabel via getCropLabelSafe + lang
 *   * tSafe for every label
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropLabelSafe } from '../../utils/crops.js';
import { speak } from '../../core/farroway/voice.js';
import { getOutbreakReports } from '../../outbreak/outbreakStore.js';
import { detectActiveClusters } from '../../outbreak/outbreakClusterEngine.js';
import { getAlertsForFarm } from '../../outbreak/farmerOutbreakAlerts.js';
import { hasFiredToday, markFired } from '../../outbreak/outbreakNotifications.js';

const SEV_COLOR = Object.freeze({
  high:   { bg: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.55)', fg: '#FCA5A5' },
  medium: { bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.55)', fg: '#FCD34D' },
  low:    { bg: 'rgba(59,130,246,0.16)', border: 'rgba(59,130,246,0.45)', fg: '#93C5FD' },
});

export default function OutbreakAlertBanner({
  farm     = null,
  farmerId = null,
  onCheck  = null,
}) {
  const { lang } = useTranslation();
  const [hidden, setHidden] = useState(false);

  // Compute alerts for this farm. Memoised on the farm + report
  // mirror so re-renders are cheap.
  const alert = useMemo(() => {
    if (!farm) return null;
    const reports  = getOutbreakReports();
    const clusters = detectActiveClusters(reports);
    const matched  = getAlertsForFarm(farm, clusters);
    return matched && matched.length ? matched[0] : null;
  }, [farm]);

  const sev = alert ? (SEV_COLOR[alert.severity] || SEV_COLOR.low) : SEV_COLOR.low;

  const cropLabel = useMemo(() => {
    if (!alert) return '';
    return getCropLabelSafe(alert.crop, lang) || alert.crop || '';
  }, [alert, lang]);

  // Auto-play voice once per day per cluster (spec section 7).
  useEffect(() => {
    if (hidden || !alert) return;
    const key = farmerId || (farm && farm.id) || 'anon';
    if (hasFiredToday(alert.id, key)) return;
    const msg = tSafe('outbreak.nearbyRiskMessage',
      'Pest risk reported near you. Check your crop today.');
    try { speak(msg); } catch { /* swallow */ }
    markFired(alert.id, key);
  }, [alert, farmerId, farm, hidden]);

  if (hidden || !alert) return null;

  function handleSpeak() {
    const msg = tSafe('outbreak.nearbyRiskMessage',
      'Pest risk reported near you. Check your crop today.');
    try { speak(msg); } catch { /* swallow */ }
  }

  function handleCheck() {
    setHidden(true);
    if (typeof onCheck === 'function') {
      try { onCheck(alert); } catch { /* swallow */ }
    }
  }

  return (
    <section role="alert" aria-live="polite" data-testid="outbreak-alert-banner"
             style={{
               ...S.banner,
               background: `linear-gradient(135deg, ${sev.bg} 0%, rgba(15,32,52,0.92) 100%)`,
               borderColor: sev.border,
               color: sev.fg,
             }}>
      <span style={S.icon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <div style={S.text}>
        <strong style={{ ...S.title, color: sev.fg }}>
          {tSafe('outbreak.nearbyRiskTitle', 'Pest risk near you')}
        </strong>
        <span style={S.body}>
          {tSafe('outbreak.nearbyRiskMessage',
            'Pest risk reported near you. Check your crop today.')}
        </span>
        {(cropLabel || alert.severity) && (
          <span style={S.metaRow}>
            {cropLabel && <span style={S.metaPill}>{cropLabel}</span>}
            <span style={{ ...S.metaPill, ...S.metaSev, color: sev.fg, borderColor: sev.border }}>
              {tSafe(`outbreak.severity${alert.severity[0].toUpperCase()}${alert.severity.slice(1)}`, alert.severity)}
            </span>
          </span>
        )}
      </div>
      <div style={S.actions}>
        <button type="button" onClick={handleSpeak}
                style={S.voiceBtn}
                aria-label={tSafe('common.listen', 'Listen')}
                data-testid="outbreak-alert-voice">
          {'\uD83D\uDD0A'}
        </button>
        <button type="button" onClick={handleCheck}
                style={S.primaryBtn}
                data-testid="outbreak-alert-check">
          {tSafe('outbreak.checkCrop', 'Check crop')}
        </button>
        <button type="button" onClick={() => setHidden(true)}
                style={S.dismissBtn}
                aria-label={tSafe('common.dismiss', 'Dismiss')}
                data-testid="outbreak-alert-dismiss">
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
    flexWrap: 'wrap',
  },
  icon: { fontSize: '1.5rem', flexShrink: 0 },
  text: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  title: { fontSize: '0.9375rem', fontWeight: 800 },
  body: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.4 },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.125rem' },
  metaPill: {
    fontSize: '0.6875rem', fontWeight: 700,
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#EAF2FF',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  metaSev: { background: 'transparent' },
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
