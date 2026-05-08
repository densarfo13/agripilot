/**
 * encouragementCaptions.js — calm, supportive captions for the
 * Garden Mode share cards.
 *
 * Picks ONE caption based on plant memory + share context.
 * Returns a translation key + English fallback, never raw English
 * — UI consumes via tSafe so the share card matches the active
 * locale.
 *
 * Categories (spec §7):
 *   • general           — generic gentle encouragement
 *   • flowering         — first flower / flowering started
 *   • fruiting          — first fruit / fruiting underway
 *   • harvest           — first pick / harvest ready
 *   • recovery          — care after a flagged scan
 *   • streak            — multi-day care streak (3 / 7+)
 *   • progress          — generic visible progress (stage advance)
 *   • firstScan         — first scan saved
 *
 * Strict-rule audit
 *   • Pure function, no I/O.
 *   • Always returns a non-null caption object.
 *   • Never throws.
 *   • Voicing: supportive, calm, non-competitive, non-judgmental.
 *   • No "guaranteed", no "cured", no overpromising.
 */

const CAPTIONS = Object.freeze({
  general: [
    { key: 'share.caption.general.steady',  fallback: 'Steady care makes a difference.' },
    { key: 'share.caption.general.adds',    fallback: 'Small daily care adds up.' },
    { key: 'share.caption.general.patience', fallback: 'Growth takes patience.' },
  ],
  flowering: [
    { key: 'share.caption.flowering.started', fallback: 'Flowering started — exciting times.' },
    { key: 'share.caption.flowering.steady',  fallback: 'Keep watering steady through flowering.' },
  ],
  fruiting: [
    { key: 'share.caption.fruiting.start',    fallback: 'First fruit on the way.' },
    { key: 'share.caption.fruiting.steady',   fallback: 'Steady moisture helps fruit develop.' },
  ],
  harvest: [
    { key: 'share.caption.harvest.first',     fallback: 'First harvest — daily care paid off.' },
    { key: 'share.caption.harvest.steady',    fallback: 'Pick at peak colour and size.' },
  ],
  recovery: [
    { key: 'share.caption.recovery.steady',   fallback: 'Steady care helped this plant recover.' },
    { key: 'share.caption.recovery.healthier', fallback: 'Looking healthier after some attention.' },
  ],
  streak: [
    { key: 'share.caption.streak.3',          fallback: 'Three days of care this week.' },
    { key: 'share.caption.streak.7',          fallback: 'A full week of steady care.' },
  ],
  progress: [
    { key: 'share.caption.progress.advance',  fallback: 'Your plant is progressing well.' },
    { key: 'share.caption.progress.healthier', fallback: 'Looking healthier this week.' },
  ],
  firstScan: [
    { key: 'share.caption.firstScan.saved',   fallback: 'First plant scan saved.' },
  ],
});

const FALLBACK_CAPTION = Object.freeze({
  key:      'share.caption.general.steady',
  fallback: 'Steady care makes a difference.',
});

/**
 * pickCaption(ctx) → { key, fallback }
 *
 * @param {object} ctx
 *   category               'general'|'flowering'|'fruiting'|'harvest'|'recovery'|'streak'|'progress'|'firstScan'
 *   streakDays             number — used by 'streak' to pick 3 vs 7
 *
 * Picks one caption from the matched category. Pure-deterministic
 * within the same input via a small hash so the same plant doesn't
 * see the caption oscillate render-to-render.
 */
export function pickCaption(ctx) {
  try {
    const safe = (ctx && typeof ctx === 'object') ? ctx : {};
    // Normalize category — accept any casing the caller passes
    // ('firstScan', 'FirstScan', 'firstscan' all match).
    const rawCat = String(safe.category || 'general');
    const cat    = _resolveCategory(rawCat);
    const list = CAPTIONS[cat] || CAPTIONS.general || [FALLBACK_CAPTION];

    if (cat === 'streak') {
      const d = Number(safe.streakDays);
      if (Number.isFinite(d) && d >= 7) return list.find((c) => c.key.endsWith('.7')) || list[0];
      return list.find((c) => c.key.endsWith('.3')) || list[0];
    }
    if (cat === 'firstScan') {
      // Single-row category — short-circuit hash logic.
      return list[0] || FALLBACK_CAPTION;
    }

    // Stable index: small hash of the seed (caller can pass nickname
    // or scanId to keep the caption consistent across renders).
    const seed = String(safe.seed || safe.nickname || cat);
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % list.length;
    return list[idx] || FALLBACK_CAPTION;
  } catch {
    return FALLBACK_CAPTION;
  }
}

/**
 * _resolveCategory(raw) — normalize caller-supplied category to
 * the canonical CAPTIONS key (case- and dash-insensitive).
 */
function _resolveCategory(raw) {
  const norm = String(raw || '').toLowerCase().replace(/[-_\s]/g, '');
  if (!norm) return 'general';
  // Match by lowercased key — CAPTIONS keys are flat ASCII.
  for (const key of Object.keys(CAPTIONS)) {
    if (key.toLowerCase() === norm) return key;
  }
  return 'general';
}

/**
 * inferCategory(memory) — derive the best caption category from
 * plant memory signals. Used by the auto-suggest "want to share?"
 * surface so the spec's §11 delight moments get a fitting caption
 * out of the box.
 *
 * Priority chain (highest → lowest):
 *   stageJustAdvanced → flowering / fruiting / harvest
 *   recoveryFiredRecently → recovery
 *   careStreakDays >= 3 → streak
 *   firstScanLogged → firstScan
 *   else → general
 */
export function inferCategory(memory) {
  try {
    const m = (memory && typeof memory === 'object') ? memory : {};
    const stage = String(m.stageJustAdvanced || '').toLowerCase();
    if (stage.includes('flower'))                       return 'flowering';
    if (stage.includes('fruit'))                        return 'fruiting';
    if (stage.includes('harvest') || stage.includes('ready')) return 'harvest';
    if (m.recoveryFiredRecently === true)               return 'recovery';
    if (Number(m.careStreakDays) >= 3)                  return 'streak';
    if (m.firstScanLogged === true)                     return 'firstScan';
    return 'general';
  } catch { return 'general'; }
}

export const _internal = Object.freeze({
  CAPTIONS,
  FALLBACK_CAPTION,
});
