/**
 * useContextIntelligence — React hook for the Context Intelligence Engine.
 *
 *   const intel = useContextIntelligence({ weather, farm, profile });
 *
 * Derives all engine inputs from the supplied props + localStorage,
 * then returns a fully-computed ContextIntelligence object.
 *
 * Props (all optional)
 *   weather  — from useLiveWeather() — { weatherType, temp, rainChance, … }
 *   farm     — from localStorage / farm resolver — { crop, cropStage, region,
 *               indoor, containerSize, farmType, … }
 *   profile  — from ProfileContext — { crop, cropStage, region, … }
 *
 * Returns always-complete ContextIntelligence:
 *   {
 *     todayTask:      { title, reason, urgency, cta, category }
 *     alert:          { id, title, message, priority } | null
 *     recommendation: { text, action, actionPath, type }
 *     sellPrompt:     string | null
 *     fundingPrompt:  string | null
 *     source:         string
 *     mode:           'farm' | 'garden'
 *   }
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally — rules-of-hooks safe.
 *   • Never throws — every path guarded by try/catch.
 *   • No network, no async, no blocking I/O.
 *   • useMemo so it never blocks the render.
 *   • SSR-safe — localStorage access guarded.
 */

import { useMemo } from 'react';
import { computeContextIntelligence } from '../lib/intelligence/contextEngine.js';
import { getScanUsefulHistory } from '../lib/scan/scanHistoryStore.js';
import { readGrowMode } from '../lib/growMode.js';

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {object|null} [opts.weather]   — useLiveWeather() result
 * @param {object|null} [opts.farm]      — active farm record from localStorage
 * @param {object|null} [opts.profile]   — ProfileContext.profile
 */
export default function useContextIntelligence({
  weather = null,
  farm    = null,
  profile = null,
} = {}) {
  // useMemo key depends on weather + farm + profile identity.
  // Scan history is read inside the memo — it's synchronous localStorage,
  // always the freshest value when any of the primary inputs change.
  return useMemo(() => {
    try {
      // ── Mode ───────────────────────────────────────────────
      let mode = 'farm';
      try { mode = readGrowMode(); } catch { /* swallow */ }

      // ── Weather ────────────────────────────────────────────
      const w = (weather && typeof weather === 'object') ? weather : {};
      const weatherType = typeof w.weatherType === 'string' ? w.weatherType : 'unknown';
      const temp        = typeof w.temp       === 'number'  ? w.temp       : null;
      const rainChance  = typeof w.rainChance === 'number'  ? w.rainChance : null;

      // ── Farm / profile ─────────────────────────────────────
      const f = (farm    && typeof farm    === 'object') ? farm    : {};
      const p = (profile && typeof profile === 'object') ? profile : {};

      const crop          = f.crop          || f.cropName  || p.crop          || null;
      const cropStage     = f.cropStage     || f.stage     || p.cropStage     || null;
      const region        = f.region        || f.location  || p.region        || null;
      const indoor        = f.indoor        ?? f.isIndoor  ?? p.indoor        ?? null;
      const containerSize = f.containerSize || f.plotSize  || p.containerSize || null;

      // ── Recent scan category ───────────────────────────────
      // Read scan history synchronously. The history is already ordered
      // newest-first (getScanUsefulHistory reverses before returning).
      let recentScanCategory = null;
      try {
        const history = getScanUsefulHistory();
        if (Array.isArray(history) && history.length > 0) {
          const top = history[0];
          // Only surface the category when the scan is recent (≤ 24 h).
          if (top && top.category && top.createdAt) {
            const ageMs = Date.now() - new Date(top.createdAt).getTime();
            if (ageMs < 24 * 60 * 60 * 1000) {
              recentScanCategory = top.category;
            }
          } else if (top && top.category) {
            recentScanCategory = top.category;
          }
        }
      } catch { /* swallow */ }

      return computeContextIntelligence({
        mode,
        weatherType,
        temp,
        rainChance,
        crop,
        cropStage,
        region,
        indoor,
        containerSize,
        recentScanCategory,
      });
    } catch {
      // If anything above throws, compute with empty context —
      // the engine always returns a usable fallback.
      return computeContextIntelligence({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Weather: re-run when numeric / type signals change
    weather?.weatherType,
    weather?.temp,
    weather?.rainChance,
    // Farm: re-run when primary crop context changes
    farm?.crop,
    farm?.cropName,
    farm?.cropStage,
    farm?.stage,
    farm?.farmType,
    farm?.indoor,
    farm?.containerSize,
    // Profile fallbacks
    profile?.crop,
    profile?.cropStage,
  ]);
}

export { useContextIntelligence };
