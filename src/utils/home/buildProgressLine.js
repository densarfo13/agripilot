/**
 * buildProgressLine.js — lightweight progress summary for the
 * Home screen. Sits UNDER the dominant card, never competes.
 *
 * Callers supply the counters they already track (outcomeTracking
 * or the Today engine) — this helper only decides the right
 * wording. Four distinct lines:
 *
 *   • "All done for now"              — done == total && total > 0
 *   • "{done} of {total} done today"  — 0 < done < total
 *   • "On track"                      — done > 0 && total unknown
 *   • "Nothing queued today"          — total == 0 && done == 0
 *
 * Output:
 *   {
 *     key:       i18n key,
 *     fallback:  English default,
 *     vars:      { done, total } token payload,
 *     summary:   resolved string (if t provided),
 *     variant:   'all_done' | 'in_progress' | 'on_track' | 'empty',
 *   }
 */

function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v || v === key) return fallback;
  return v;
}

function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

export function buildProgressLine(input = {}, t = null) {
  const safe = input && typeof input === 'object' ? input : {};
  const done  = Number.isFinite(Number(safe.done))  ? Math.max(0, Number(safe.done))  : 0;
  const total = Number.isFinite(Number(safe.total)) ? Math.max(0, Number(safe.total)) : null;

  // Variant selection — simple rules, no clever branches.
  let variant;
  if (total === 0 && done === 0) variant = 'empty';
  else if (total != null && done >= total && total > 0) variant = 'all_done';
  else if (total != null && done > 0 && done < total) variant = 'in_progress';
  else if (done > 0) variant = 'on_track';
  else variant = 'empty';

  const table = {
    all_done:    { key: 'home.progress.all_done',    fallback: 'All done for now' },
    in_progress: { key: 'home.progress.x_of_y',      fallback: '{done} of {total} done today' },
    on_track:    { key: 'home.progress.on_track',    fallback: 'On track' },
    empty:       { key: 'home.progress.nothing_queued', fallback: 'Nothing queued today' },
  };
  const row = table[variant];
  const raw = resolve(t, row.key, row.fallback);
  const summary = interpolate(raw, { done, total: total ?? 0 });

  return {
    variant,
    key: row.key,
    fallback: row.fallback,
    vars: { done, total: total ?? 0 },
    summary,
  };
}

export const _internal = { resolve, interpolate };
