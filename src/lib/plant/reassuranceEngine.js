/**
 * reassuranceEngine.js — calm message picker for Garden Mode.
 *
 * Combines plant memory (last scan / last task / streak / stage)
 * with the spec's emotional principles:
 *   • reassuring, not scary
 *   • no guilt, no overpromising
 *   • no "cured" / "fixed" / "guaranteed"
 *   • short and supportive
 *
 * The engine returns ONE message at a time so Home stays calm:
 *   { kind, key, fallback, params, severity }
 *
 * `kind` is the surface category:
 *   'reassurance'     — generic supportive line
 *   'recovery'        — after a follow-up task to a flagged scan
 *   'delight'         — soft positive moment (streak / first scan / flowering)
 *   'beginner'        — first-time guidance
 *
 * UI consumes via tSafe(key, fallback). The engine never returns
 * raw English without a key, so missing-locale fallback is one
 * lookup away.
 *
 * Strict-rule audit
 *   • Pure function. No I/O. Never throws.
 *   • Always returns a non-null object — even with empty input.
 *   • No diagnosis claims; no chemistry; no "this will fix it".
 */

// ─── Inputs / outputs ─────────────────────────────────────────────

/**
 * pickMessage(ctx) → ReassuranceMessage | null
 *
 * @param {object} ctx
 *   recentScanCategory   — 'yellowing' | 'pests' | 'wilting' | 'healthy' | …
 *   lastTaskCompletedAt  — ISO datetime string, or null
 *   careStreakDays       — integer
 *   timelineCount        — total milestone events on file
 *   firstScanLogged      — boolean (timeline has any scan_saved)
 *   firstFlowerLogged    — boolean
 *   firstFruitLogged     — boolean
 *   isFirstSession       — boolean (no plant + no timeline yet)
 *   stageJustAdvanced    — 'flowering' | 'fruiting' | 'ready_to_pick' | null
 *   weatherType          — current weather (optional context)
 *
 * Returns null when no message applies (UI hides the chip).
 */
export function pickMessage(ctx) {
  try {
    const safe = (ctx && typeof ctx === 'object') ? ctx : {};

    // 1. Stage-advance delight — single highest-priority moment.
    if (safe.stageJustAdvanced) {
      const stage = String(safe.stageJustAdvanced).toLowerCase();
      if (stage.includes('flower')) {
        return _msg('delight',
          'plant.delight.flowering',
          '🌼 Flowering started — keep moisture steady.');
      }
      if (stage.includes('fruit')) {
        return _msg('delight',
          'plant.delight.fruiting',
          '🍅 Fruiting stage is exciting. Check daily.');
      }
      if (stage.includes('ready') || stage.includes('harvest')) {
        return _msg('delight',
          'plant.delight.readyToPick',
          '🌿 Ready to pick. Harvest when colour and size look right.');
      }
      return _msg('delight',
        'plant.delight.newStage',
        '🌿 New stage unlocked. Your plant is making progress.');
    }

    // 2. Recovery moment — completed task after a flagged scan.
    //    "Recently" = lastTaskCompletedAt within last 24h AND scan
    //    flagged something other than healthy.
    if (safe.lastTaskCompletedAt && safe.recentScanCategory) {
      const cat = String(safe.recentScanCategory).toLowerCase();
      const scanFlagged = cat && cat !== 'healthy' && cat !== 'needs_review';
      if (scanFlagged && _isWithinLast24h(safe.lastTaskCompletedAt)) {
        return _msg('recovery',
          'plant.recovery.steadyCare',
          'Nice care. Keep monitoring for changes.');
      }
    }

    // 3. Streak delight — soft achievement.
    const streak = Number(safe.careStreakDays);
    if (Number.isFinite(streak) && streak >= 7) {
      return _msg('delight',
        'plant.delight.streak7',
        '🌿 7-day care streak — your plant feels the consistency.',
        { days: 7 });
    }
    if (Number.isFinite(streak) && streak >= 3) {
      return _msg('delight',
        'plant.delight.streak3',
        '🌿 You\'ve cared for this plant 3 times this week.',
        { days: streak });
    }

    // 4. First-scan moment — celebrate the first scan ever logged.
    if (safe.firstScanLogged === true && (Number(safe.timelineCount) || 0) <= 3) {
      return _msg('delight',
        'plant.delight.firstScan',
        '📸 First scan saved — we\'ll keep watching alongside you.');
    }

    // 5. First-fruit / first-flower — quiet celebration.
    if (safe.firstFruitLogged === true) {
      return _msg('delight',
        'plant.delight.firstFruit',
        '🍅 First fruit on the way. Steady moisture helps it grow.');
    }
    if (safe.firstFlowerLogged === true) {
      return _msg('delight',
        'plant.delight.firstFlower',
        '🌼 First flower noted. Avoid water swings during flowering.');
    }

    // 6. Beginner reassurance — first session, no plant yet.
    if (safe.isFirstSession === true) {
      return _msg('beginner',
        'plant.beginner.welcome',
        'Add your first plant to get simple daily care guidance.');
    }

    // 7. Issue-aware reassurance — if a scan flagged something
    //    recently and no recovery action yet, soften the worry.
    if (safe.recentScanCategory) {
      const cat = String(safe.recentScanCategory).toLowerCase();
      if (cat.includes('yellow')) {
        return _msg('reassurance',
          'plant.reassurance.yellowing',
          'Small yellow leaves can happen during growth. A quick check helps.');
      }
      if (cat.includes('pest') || cat.includes('hole')) {
        return _msg('reassurance',
          'plant.reassurance.pest',
          'You\'re doing okay. Check under leaves and remove damaged ones.');
      }
      if (cat.includes('wilt')) {
        return _msg('reassurance',
          'plant.reassurance.wilting',
          'Plants can recover with steady care. Check soil moisture first.');
      }
      if (cat === 'healthy') {
        return _msg('reassurance',
          'plant.reassurance.healthy',
          'Your plant looks healthy. Your care is paying off.');
      }
    }

    // 8. Generic gentle nudge — only on very calm days.
    return _msg('reassurance',
      'plant.reassurance.gentle',
      'A quick check today can help prevent bigger issues.');
  } catch {
    return _msg('reassurance',
      'plant.reassurance.gentle',
      'A quick check today can help prevent bigger issues.');
  }
}

// ─── Internal ──────────────────────────────────────────────────────

function _msg(kind, key, fallback, params = {}) {
  return Object.freeze({
    kind,
    key,
    fallback,
    params: Object.freeze({ ...params }),
    severity: kind === 'recovery' || kind === 'delight' ? 'positive' : 'calm',
  });
}

function _isWithinLast24h(iso) {
  try {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export const _internal = Object.freeze({
  _msg,
  _isWithinLast24h,
});
