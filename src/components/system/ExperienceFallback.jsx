/**
 * ExperienceFallback — drop-in safe guard for any farmer-facing
 * page that reads `activeExperience` + `activeFarmId` /
 * `activeGardenId` (final crash-prevention spec §1).
 *
 *   import ExperienceFallback from '.../system/ExperienceFallback.jsx';
 *
 *   export default function HomePage() {
 *     const guard = (
 *       <ExperienceFallback>
 *         <ActualHome />
 *       </ExperienceFallback>
 *     );
 *     return guard;
 *   }
 *
 * Behaviour
 *   1. While `useAuth().authLoading` is true OR profile is still
 *      initialising, render a lightweight "Loading your data…"
 *      screen — never the children. This prevents the 1-frame
 *      flash where `farm` is null and a child page reads
 *      `farm.name` before the data lands.
 *   2. If the user is logged out → render the "logged out" copy
 *      (with a Login button). Routes elsewhere have already
 *      navigated; this is the safety net for direct deep-links.
 *   3. If `activeExperience === 'farm'` but no farm row resolves,
 *      OR `activeExperience === 'backyard'` but no garden, render
 *      the recovery card with three buttons (Reload / Repair /
 *      Restart setup).
 *   4. Otherwise render `children` unchanged.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — every store / hook call is wrapped.
 *   * Sub-second render path on the happy case (a single
 *     truthy check on `experience` + `activeEntity`).
 */

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { tStrict } from '../../i18n/strictT.js';
import { useTranslation } from '../../i18n/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useExperience from '../../hooks/useExperience.js';
import {
  repairFarrowaySession,
  clearFarrowayCacheKeepingAuth,
} from '../../utils/repairSession.js';
import { narrowRepairActivePointers } from '../../store/multiExperience.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  bg:    '#0B1D34',
  panel: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  ink:   '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  green: '#22C55E',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '32px 16px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    textAlign: 'center',
  },
  spinner: {
    width: 28, height: 28,
    border: `3px solid ${C.border}`,
    borderTopColor: C.green,
    borderRadius: '50%',
    margin: '0 auto 4px',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  title: { margin: 0, fontSize: 18, fontWeight: 800 },
  body:  { margin: 0, fontSize: 14, color: C.inkSoft, lineHeight: 1.5 },
  btn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: '12px 16px',
    borderRadius: 12,
    border: 'none',
    fontSize: 14,
    fontWeight: 800,
    minHeight: 44,
  },
  btnPrimary: { background: C.green, color: '#062714' },
  btnGhost: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.ink,
  },
};

function _safeUseAuth() {
  try { return useAuth() || {}; }
  catch { return { user: null, authLoading: false }; }
}

function _safeUseExperience() {
  try { return useExperience(); }
  catch {
    return {
      experience: null, activeEntity: null,
      hasGarden: false, hasFarm: false, hasBoth: false,
      EXPERIENCE: { GARDEN: 'garden', FARM: 'farm' },
    };
  }
}

export default function ExperienceFallback({ children }) {
  useTranslation();
  const { user, authLoading } = _safeUseAuth();
  const xp = _safeUseExperience();

  // Final fix spec §1–§5: auto-repair + auto-redirect instead of
  // rendering the recovery card on first detection of missing
  // active context. The card stays as a last-resort surface ONLY
  // when the auto-repair has run AND still can't resolve.
  const repairAttemptedRef = useRef(false);
  const [repairResolution, setRepairResolution] = useState(null);
  // null   — not attempted yet
  // 'fixed'    — repair found a valid entity; re-render through
  //               useExperience subscription
  // 'no_data'  — no garden + no farm; redirect to onboarding
  // 'unfixed'  — repair ran and entities exist but still no
  //               valid pointer (genuine corruption — show card)

  // 1. Auth + experience still loading — render the loader.
  if (authLoading) {
    return (
      <main style={S.page} data-testid="experience-fallback-loading">
        <section style={S.card}>
          <div style={S.spinner} aria-hidden="true" />
          <h2 style={S.title}>
            {tStrict('experience.loading.title', 'Loading your data\u2026')}
          </h2>
          <p style={S.body}>
            {tStrict('experience.loading.body',
              'One moment while we restore your session.')}
          </p>
        </section>
      </main>
    );
  }

  // 2. Logged out / no user — gentle nudge to /login. The route
  //    guard above us usually handles this; this is the safety net.
  if (!user) {
    return (
      <main style={S.page} data-testid="experience-fallback-loggedout">
        <section style={S.card}>
          <h2 style={S.title}>
            {tStrict('experience.signedOut.title', 'You\u2019re signed out')}
          </h2>
          <p style={S.body}>
            {tStrict('experience.signedOut.body',
              'Sign in to see your home dashboard.')}
          </p>
          <button
            type="button"
            onClick={() => { try { window.location.assign('/login'); } catch { /* swallow */ } }}
            style={{ ...S.btn, ...S.btnPrimary }}
            data-testid="experience-fallback-login"
          >
            {tStrict('experience.signedOut.cta', 'Go to login')}
          </button>
        </section>
      </main>
    );
  }

  // 3. Active experience missing OR the active entity didn't
  //    resolve. Auto-repair before showing the recovery card.
  const exp     = xp.experience;
  const entity  = xp.activeEntity;
  const farmMissing    = exp === xp.EXPERIENCE.FARM   && !entity;
  const gardenMissing  = exp === xp.EXPERIENCE.GARDEN && !entity;
  const expMissing     = !exp;
  const needsRepair    = expMissing || farmMissing || gardenMissing;

  // Final fix spec §5: instead of immediately throwing the
  // recovery card, run the narrow repair pass once and let
  // useExperience re-resolve. If the repair finds entities,
  // the parent re-renders and the children path runs cleanly.
  // If no entities exist at all, we redirect to setup.
  // The recovery card only shows for the genuinely-corrupted
  // case where entities exist but the pointer can't resolve.
  useEffect(() => {
    if (!needsRepair) return;
    if (repairAttemptedRef.current) return;
    repairAttemptedRef.current = true;
    let resolution = 'unfixed';
    try {
      const actions = narrowRepairActivePointers();
      // Re-read snapshot via useExperience subscription —
      // the repair fired the SWITCH_EVENT so the hook will
      // refresh on the next tick.
      const noData = Array.isArray(actions)
        && actions.includes('no_data_for_repair');
      if (noData) resolution = 'no_data';
      else        resolution = 'fixed';
      try {
        trackEvent('experience_fallback_auto_repair', {
          actions, resolution,
        });
      } catch { /* swallow */ }
    } catch { resolution = 'unfixed'; }
    setRepairResolution(resolution);
  }, [needsRepair]);

  // Auto-redirect to setup when no data exists. We use
  // <Navigate> so React Router handles the transition cleanly
  // (no full reload, no history-stack pollution).
  if (needsRepair && repairResolution === 'no_data') {
    return <Navigate to="/onboarding/simple" replace />;
  }
  // Repair fixed it — render the loading branch for one frame
  // while useExperience re-subscribes; the next render lands
  // in the happy path because activeEntity now resolves.
  if (needsRepair && repairResolution === 'fixed') {
    return (
      <main style={S.page} data-testid="experience-fallback-recovering">
        <section style={S.card}>
          <div style={S.spinner} aria-hidden="true" />
          <h2 style={S.title}>
            {tStrict('experience.loading.title', 'Loading your data\u2026')}
          </h2>
        </section>
      </main>
    );
  }

  if (needsRepair && repairResolution === 'unfixed') {
    return (
      <main style={S.page} data-testid="experience-fallback-recovery">
        <section style={S.card}>
          <h2 style={S.title}>
            {tStrict('experience.recovery.title',
              'We couldn\u2019t load your farm or garden')}
          </h2>
          <p style={S.body}>
            {tStrict('experience.recovery.body',
              'Your data is safe on this device. Try one of the recovery options below.')}
          </p>
          <button
            type="button"
            onClick={() => { try { window.location.reload(); } catch { /* swallow */ } }}
            style={{ ...S.btn, ...S.btnPrimary }}
            data-testid="experience-fallback-reload"
          >
            {tStrict('experience.recovery.reload', 'Reload')}
          </button>
          <button
            type="button"
            onClick={() => {
              // Final fix spec §6: Repair Session clears ONLY the
              // three active-pointer keys (active_experience +
              // active_garden_id + active_farm_id) and re-derives
              // them from the healthy gardens/farms data. It does
              // NOT call repairFarrowaySession (which is broader
              // and clears more state — preserved in case a
              // future "deep repair" surface needs it).
              try { narrowRepairActivePointers(); }
              catch { /* swallow */ }
              try { window.location.reload(); } catch { /* swallow */ }
            }}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="experience-fallback-repair"
          >
            {tStrict('experience.recovery.repair', 'Repair session')}
          </button>
          <button
            type="button"
            onClick={() => {
              try { clearFarrowayCacheKeepingAuth(); } catch { /* swallow */ }
              try { window.location.reload(); } catch { /* swallow */ }
            }}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="experience-fallback-clear"
          >
            {tStrict('experience.recovery.clear', 'Clear local cache')}
          </button>
        </section>
      </main>
    );
  }

  // 4. Happy path.
  return children || null;
}
