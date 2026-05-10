/**
 * gardenObservations — pure observational-line generator for the
 *                      Garden mode Journal + Home surfaces.
 *
 * Elite Garden spec §2 + §3 + §7
 * ─────────────────────────────
 * Returns ONE calm, observational line for the active plant based
 * on existing local signals (timeline, plant identity, weather,
 * time-of-day, season). Never claims certainty. Never uses
 * commercial / urgency language.
 *
 *   import { selectPrimaryObservation } from
 *     'src/lib/garden/gardenObservations.js';
 *
 *   const line = selectPrimaryObservation({
 *     plant,                 // usePlantIdentity().plant
 *     timeline,              // usePlantTimeline().entries
 *     weather,               // useLiveWeather().weather (optional)
 *     now,                   // optional Date for tests
 *   });
 *   // → 'Strong sunlight this week.' / 'First flowering reached.' / null
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React. Never throws — every branch
 *     returns either a string or null.
 *   • Never references Funding / Sell / Buyer wording.
 *   • Output is observational; no "high risk" / "critical" /
 *     "urgent" tone.
 *   • Soft cap on output length (140 chars) so the calm one-line
 *     surface never wraps three deep.
 */

const MAX_LEN = 140;

/**
 * Pick the single most useful observation line for the active
 * plant. Walks a small priority ladder; returns the first match
 * or null when the plant is brand-new (the caller should render
 * a "welcome" line instead).
 *
 * @param {object}  input
 * @param {object}  [input.plant]        plant identity (nickname, plantType, growthStage)
 * @param {Array}   [input.timeline]     newest-first timeline entries
 * @param {object}  [input.weather]      cached weather snapshot
 * @param {Date}    [input.now]          current time, defaults to new Date()
 * @returns {string|null}
 */
export function selectPrimaryObservation(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  const plant    = (safe.plant && typeof safe.plant === 'object') ? safe.plant : null;
  const timeline = Array.isArray(safe.timeline) ? safe.timeline : [];
  const weather  = (safe.weather && typeof safe.weather === 'object') ? safe.weather : null;
  const now = safe.now instanceof Date ? safe.now : new Date();

  const nickname = _nickname(plant);

  try {
    // 1. First-flower / first-fruit milestones beat everything else
    //    when they're the most recent meaningful event.
    const recent = timeline[0] || null;
    if (recent && recent.type === 'flower_note') {
      return _cap(`First flowering reached on ${nickname}.`);
    }
    if (recent && recent.type === 'fruit_note') {
      return _cap(`First fruit forming on ${nickname}.`);
    }
    if (recent && recent.type === 'harvest_picked') {
      return _cap(`Harvest picked — ${nickname} is producing.`);
    }
    if (recent && recent.type === 'recovery_note') {
      return _cap(`${nickname} is recovering well.`);
    }
    if (recent && recent.type === 'stage_advanced') {
      return _cap(`${nickname} reached a new growth stage.`);
    }

    // 2. Growth-streak feel — three or more care moments in the
    //    last 14 days produces a "steady growth" observation.
    const streak = _recentMomentCount(timeline, 14, now);
    if (streak >= 3) {
      return _cap(`Steady care for ${nickname} this fortnight.`);
    }

    // 3. Weather-aware observation, kept gentle.
    if (weather) {
      const wx = _weatherObservation(weather, nickname);
      if (wx) return _cap(wx);
    }

    // 4. Stage-based observation when no recent events.
    if (plant && plant.growthStage) {
      const stage = String(plant.growthStage).toLowerCase();
      if (stage === 'seedling') {
        return _cap(`${nickname} is settling in.`);
      }
      if (stage === 'growing') {
        return _cap(`${nickname} is in steady growth.`);
      }
      if (stage === 'flowering') {
        return _cap(`${nickname} is in bloom.`);
      }
      if (stage === 'fruiting') {
        return _cap(`${nickname} is fruiting.`);
      }
      if (stage === 'ready_to_pick') {
        return _cap(`${nickname} is ready to pick.`);
      }
      if (stage === 'resting') {
        return _cap(`${nickname} is resting.`);
      }
    }

    // 5. Plant exists but no events yet — gentle invitation.
    if (plant && plant.id) {
      return _cap(`Your journal with ${nickname} starts here.`);
    }
  } catch { /* never throw — fall through */ }

  return null;
}

/**
 * Daylight-aware salutation flavoring. Returns 'morning' /
 * 'afternoon' / 'evening' so the page can reuse the same value
 * the global greeting helper produces. Lives here so this module
 * stays self-contained for tests.
 */
export function gardenTimeOfDay(now = new Date()) {
  try {
    const d = now instanceof Date ? now : new Date(now);
    const h = d.getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  } catch { return 'afternoon'; }
}

/**
 * Approximate Northern-Hemisphere season. Tropical regions don't
 * use this; the orchestrator's regional intelligence handles those.
 * Used purely for the calm tint on the Journal hero — never for
 * agronomic decisions.
 */
export function gardenSeason(now = new Date()) {
  try {
    const d = now instanceof Date ? now : new Date(now);
    const m = d.getMonth(); // 0-based
    if (m >= 2 && m <= 4)  return 'spring';
    if (m >= 5 && m <= 7)  return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
  } catch { return 'summer'; }
}

// ─── Internals ───────────────────────────────────────────────────

function _nickname(plant) {
  const raw = plant && typeof plant.nickname === 'string' ? plant.nickname.trim() : '';
  if (raw && raw.toLowerCase() !== 'my plant') return raw;
  if (plant && plant.plantType) {
    const slug = String(plant.plantType);
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  return 'your plant';
}

function _recentMomentCount(timeline, days, now) {
  try {
    const cutoff = now.getTime() - (days * 24 * 60 * 60 * 1000);
    let n = 0;
    for (const entry of timeline) {
      if (!entry || !entry.createdAt) continue;
      const t = Date.parse(entry.createdAt);
      if (Number.isFinite(t) && t >= cutoff) n += 1;
    }
    return n;
  } catch { return 0; }
}

function _weatherObservation(weather, nickname) {
  const tempC = _num(weather.tempC ?? weather.temperature ?? weather.temp);
  const humidity = _num(weather.humidity ?? weather.relativeHumidity);
  const rainProb = _num(weather.rainProbability ?? weather.precipitationProbability ?? weather.rainProb);

  // Strong rain coming — gentle hint, never alarmist.
  if (Number.isFinite(rainProb) && rainProb >= 0.7) {
    return `Rain looks likely — ${nickname} may not need watering today.`;
  }
  // Dry + warm — soil-moisture nudge.
  if (Number.isFinite(tempC) && tempC >= 28
      && Number.isFinite(humidity) && humidity > 0 && humidity < 0.4) {
    return `Warm and dry — check soil moisture for ${nickname}.`;
  }
  // High humidity feel.
  if (Number.isFinite(humidity) && humidity >= 0.8) {
    return `Humidity is high — keep airflow good around ${nickname}.`;
  }
  // Sunny calm day.
  if (Number.isFinite(tempC) && tempC >= 20 && tempC < 28) {
    return `Mild conditions — a quiet good day for ${nickname}.`;
  }
  // Cool day.
  if (Number.isFinite(tempC) && tempC < 10) {
    return `Cool air today — ${nickname} may slow growth a little.`;
  }
  return null;
}

function _num(v) {
  if (v == null) return NaN;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function _cap(s) {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_LEN) return trimmed;
  return trimmed.slice(0, MAX_LEN - 1) + '…';
}

export const _internal = Object.freeze({
  MAX_LEN, _nickname, _recentMomentCount, _weatherObservation,
});

const _module = {
  selectPrimaryObservation,
  gardenTimeOfDay,
  gardenSeason,
};
export default _module;
