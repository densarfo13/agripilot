/**
 * CropFit — high-conversion "one best crop first" decision page.
 *
 * Contract:
 *   • shows exactly ONE best crop above the fold
 *   • "Use This Crop" is the single primary action
 *   • up to two alternatives below, collapsed by default
 *   • never empty — falls back to a starter crop so there's always
 *     something to act on (safety §5)
 *
 * Mounted at /crop-fit/quick (additive — the legacy /crop-fit
 * wizard route still exists for callers that need it).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from '../i18n/index.js';
import { getCropLabel } from '../utils/crops.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
import { showToast } from '../core/farm/unified.js';
import { readOnboardingState } from '../core/welcome/onboardingState.js';
import {
  selectBestCrop,
  resolveCropDecisionDestination,
  persistSelectedCrop,
} from '../core/welcome/selectBestCrop.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function CropFit() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { profile, editFarm } = useProfile();

  const [loading,     setLoading]     = useState(true);
  const [best,        setBest]        = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [applying,    setApplying]    = useState(false);
  const [showAlt,     setShowAlt]     = useState(false);

  // ─── Load recommendation (non-blocking) ─────────────────
  useEffect(() => {
    // Minimal artificial delay so the skeleton isn't jumpy; the
    // decision itself is synchronous and deterministic.
    const timer = setTimeout(() => {
      const onboarding = readOnboardingState();
      const { best: b, alternatives: a, source } = selectBestCrop({
        profile, onboarding, maxAlternatives: 2,
      });
      setBest(b); setAlternatives(a); setLoading(false);
      safeTrackEvent('cropFit.quick_loaded', { code: b?.code, source });
    }, 400);
    return () => clearTimeout(timer);
  }, [profile]);

  async function handleUseCrop() {
    if (!best || applying) return;
    setApplying(true);
    persistSelectedCrop(best.code);
    safeTrackEvent('cropFit.quick_crop_applied', { code: best.code });

    // If we have a farm id, patch it now so the dashboard reflects
    // the choice immediately. Otherwise just route to /farm/new
    // with the stored selection.
    const farmId = profile && profile.id;
    if (farmId && typeof editFarm === 'function') {
      try {
        await editFarm(farmId, { cropType: String(best.code).toUpperCase() });
        showToast(resolve(t, 'cropFit.results.farmUpdated',
          'Farm updated successfully'));
      } catch (err) {
        // Non-blocking: still let the user proceed; the selection
        // is in localStorage and the next screen can retry.
        showToast(resolve(t, 'cropFit.results.useCropFailed',
          'Could not update your farm. You can still continue.'));
      }
    }

    const dest = resolveCropDecisionDestination({ profile });
    setApplying(false);
    navigate(dest);
  }

  function handleBack() { navigate('/welcome-farmer'); }

  // ─── Localized copy ──────────────────────────────────────
  const loadingLbl = resolve(t, 'cropFit.quick.loading',    'Finding best crop for you\u2026');
  const titleLbl   = resolve(t, 'cropFit.quick.title',      'Best Crop for You \uD83C\uDF31');
  const subLbl     = resolve(t, 'cropFit.quick.subtitle',
    'One strong choice based on your location and conditions.');
  const scoreLbl   = resolve(t, 'cropFit.quick.score',      'Score');
  const riskLbl    = resolve(t, 'cropFit.quick.risk',       'Risk');
  const useLbl     = resolve(t, 'cropFit.quick.useCrop',    'Use This Crop');
  const savingLbl  = resolve(t, 'common.saving',            'Saving\u2026');
  const altHeader  = resolve(t, 'cropFit.quick.otherOptions','Other options');
  const showAltLbl = resolve(t, 'cropFit.quick.showAlt',    'See alternatives');
  const hideAltLbl = resolve(t, 'cropFit.quick.hideAlt',    'Hide alternatives');
  const backLbl    = resolve(t, 'common.back',              'Back');

  if (loading) {
    return (
      <main style={S.page} data-screen="crop-fit-quick" data-state="loading">
        <p style={S.loadingLine}>{loadingLbl}</p>
      </main>
    );
  }

  if (!best) {
    // Shouldn't happen — selectBestCrop always returns one — but
    // guard anyway so "never empty screen" is enforced.
    return (
      <main style={S.page} data-screen="crop-fit-quick" data-state="empty">
        <h2 style={S.title}>{titleLbl}</h2>
        <p style={S.sub}>{subLbl}</p>
        <button type="button" onClick={handleBack} style={S.secondaryBtn}>
          {backLbl}
        </button>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="crop-fit-quick">
      <h2 style={S.title}>{titleLbl}</h2>
      <p style={S.sub}>{subLbl}</p>

      {/* ─── Primary recommendation ───────────────────── */}
      <section style={S.primaryCard} data-testid="cropfit-best">
        <h3 style={S.cropName}>{getCropLabel(best.code || best.name, lang) || best.name}</h3>
        <div style={S.statsRow}>
          <span style={S.statPill}>{scoreLbl}: <strong>{best.score}</strong></span>
          <span style={{ ...S.statPill, ...riskStyleFor(best.risk) }}>
            {riskLbl}: <strong>{resolve(t, `cropFit.quick.risk.${best.risk}`, best.risk)}</strong>
          </span>
        </div>
        <p style={S.reason}>
          {resolve(t, best.reasonKey, best.reasonFallback)}
        </p>
        <button
          type="button"
          onClick={handleUseCrop}
          disabled={applying}
          style={{ ...S.primaryBtn, opacity: applying ? 0.7 : 1 }}
          data-testid="cropfit-use"
        >
          {applying ? savingLbl : useLbl}
        </button>
      </section>

      {/* ─── Alternatives (collapsed by default) ──────── */}
      {Array.isArray(alternatives) && alternatives.length > 0 && (
        <section style={S.altSection} data-testid="cropfit-alts">
          <button
            type="button"
            onClick={() => setShowAlt((x) => !x)}
            style={S.altToggle}
            aria-expanded={showAlt}
            data-testid="cropfit-alt-toggle"
          >
            {showAlt ? hideAltLbl : showAltLbl}
          </button>
          {showAlt && (
            <>
              <p style={S.altHeader}>{altHeader}</p>
              <ul style={S.altList}>
                {alternatives.map((c) => (
                  <li key={c.code} style={S.altRow}>
                    <strong>{c.name}</strong>
                    <span style={S.altScore}>{scoreLbl}: {c.score}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div style={S.footer}>
        <button type="button" onClick={handleBack} style={S.secondaryBtn}
                data-testid="cropfit-back">
          {backLbl}
        </button>
      </div>
    </main>
  );
}

function riskStyleFor(level) {
  switch (String(level).toLowerCase()) {
    case 'high':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    case 'medium': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    default:       return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
  }
}

const S = {
  page: {
    maxWidth: 520, margin: '0 auto', padding: '24px 20px 40px',
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    boxSizing: 'border-box',
  },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 700 },
  sub:   { margin: '0 0 20px', color: 'rgba(255,255,255,0.7)' },
  loadingLine: { color: 'rgba(255,255,255,0.7)' },
  primaryCard: {
    padding: '18px 16px 16px', borderRadius: 14,
    border: '2px solid #22C55E',
    background: 'rgba(34,197,94,0.08)',
  },
  cropName: { margin: 0, fontSize: 22, fontWeight: 700 },
  statsRow: { display: 'flex', gap: 10, margin: '10px 0' },
  statPill: {
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(255,255,255,0.05)', fontSize: 13,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  reason: { margin: '8px 0 12px', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  primaryBtn: {
    padding: '12px 16px', borderRadius: 10, border: 'none',
    background: '#2e7d32', color: '#fff', fontWeight: 700,
    fontSize: 16, cursor: 'pointer', width: '100%',
  },
  altSection: { marginTop: 22 },
  altToggle: {
    padding: '8px 10px', borderRadius: 8,
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.75)', fontSize: 14, cursor: 'pointer',
    fontWeight: 600,
  },
  altHeader: { margin: '12px 0 6px', fontWeight: 700 },
  altList:   { margin: 0, padding: 0, listStyle: 'none' },
  altRow: {
    padding: '8px 10px', marginTop: 6, borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  altScore: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  footer: { marginTop: 22 },
  secondaryBtn: {
    padding: '8px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer', fontWeight: 600,
  },
};
