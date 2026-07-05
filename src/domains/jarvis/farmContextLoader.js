/**
 * farmContextLoader.js — Jarvis MVP context (honest kernel).
 *
 * READ-ONLY composition over state the app already holds. No new stores, no network
 * calls, no profiling. Every field is best-effort: absent context degrades the answer
 * template, never invents one. SSR-safe; never throws.
 */

const _safe = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch { return fb; } };

export function loadFarmContext() {
  const w = typeof window !== 'undefined' ? window : {};
  return Object.freeze({
    online: _safe(() => (typeof navigator !== 'undefined' ? navigator.onLine !== false : true), true),
    route: _safe(() => w.location && w.location.pathname, '') || '',
    // Existing kernel state, if the runtimes have populated it this session.
    farmName: _safe(() => w.__farmBrainState && w.__farmBrainState.farm && w.__farmBrainState.farm.name, null),
    todayTaskTitle: _safe(() => {
      const s = w.__farmBrainState;
      const t = s && s.today && Array.isArray(s.today.tasks) ? s.today.tasks[0] : null;
      return t && (t.title || t.name) ? String(t.title || t.name) : null;
    }, null),
    // Environmental flags (Farroway X context-awareness contract).
    voiceDisabled: _safe(() => w.localStorage && w.localStorage.getItem('farroway.jarvis.enabled') === '0', false),
  });
}

export default loadFarmContext;
