/**
 * contextEngine.js — Farroway Context Intelligence Engine v1.
 *
 * Pure deterministic rules. No ML, no AI API, no network calls.
 * Same input always produces the same output. Never throws.
 *
 * Entry point:
 *   import { computeContextIntelligence } from './contextEngine.js';
 *
 *   const intel = computeContextIntelligence({
 *     mode:               'farm',        // 'farm' | 'garden'
 *     weatherType:        'rain',        // useLiveWeather.weatherType
 *     temp:               29,            // °C
 *     rainChance:         70,            // 0-100
 *     crop:               'maize',
 *     cropStage:          'vegetative',
 *     region:             'Ashanti',
 *     indoor:             false,
 *     containerSize:      'small',       // garden only
 *     recentScanCategory: 'yellowing',  // from scanHistoryStore
 *   });
 *
 * Output shape (always complete, never null):
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
 * Rules (spec §1-5):
 *   1. Never block Home render — pure sync, no await.
 *   2. Always return fallback — outer try/catch guarantees non-null.
 *   3. No AI API dependency — deterministic lookup tables only.
 *   4. No ML model required — rule predicates only.
 *   5. No hardcoded onboarding prompts — outputs are care/market actions.
 */

// ─── Fallback constants ───────────────────────────────────────────

const FALLBACK_TASK = Object.freeze({
  title:    'Check soil moisture around your crop',
  reason:   'Feel the soil before watering — water only if it reads dry.',
  urgency:  'medium',
  cta:      'Mark as done',
  category: 'crop-care',
});

const FALLBACK_RECOMMENDATION = Object.freeze({
  text:       'Walk around your growing area today and note anything unusual.',
  action:     null,
  actionPath: null,
  type:       'general',
});

// ─── Internal helpers ─────────────────────────────────────────────

/** Lowercase trim, or '' for non-strings. */
function _s(v) { return typeof v === 'string' ? v.toLowerCase().trim() : ''; }

/** Safe finite number, or null. */
function _n(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

/** Crop display name, safe for all input types. */
function _cropName(crop, fallback) {
  if (typeof crop === 'string' && crop.trim()) return crop.trim();
  if (crop && typeof crop === 'object' && crop.name) return String(crop.name);
  return fallback;
}

// ─── Scan-followup tasks ──────────────────────────────────────────

/**
 * Map a scan category to a specific follow-up task.
 * Returns null when category is unrecognised — caller falls through.
 *
 * @param {string} category  — e.g. 'yellowing', 'holes_or_pest_damage'
 * @param {string} name      — crop / plant display name
 * @param {'farm'|'garden'} mode
 */
function _scanFollowup(category, name, mode) {
  const c     = _s(category);
  const plant = mode === 'garden' ? 'plant' : 'crop';
  // When name is a specific crop ('tomato', 'maize') use it as-is.
  // When name is the generic fallback ('crop' or 'plant') add "your "
  // so the text reads naturally — "your crop / your plant" not "crop".
  const isGeneric = !name || name === 'crop' || name === 'plant';
  const label = isGeneric ? `your ${plant}` : name;

  if (c.includes('yellow')) {
    return {
      title:    `Check moisture and light for ${label}`,
      reason:   'Yellowing leaves can mean over-watering, under-watering, or low light. Check each.',
      urgency:  'high',
      cta:      'Inspect now',
      category: 'scan-followup',
    };
  }

  if (c.includes('pest') || c.includes('hole') || c.includes('insect')) {
    return {
      title:    `Inspect ${label} carefully for pest damage`,
      reason:   'A recent scan flagged possible pests. Check under leaves and near the stem.',
      urgency:  'high',
      cta:      'Inspect',
      category: 'pest-check',
    };
  }

  if (c.includes('disease') || c.includes('blight') || c.includes('spot')) {
    return {
      title:    `Check ${label} for signs of disease spread`,
      reason:   'A recent scan flagged a possible disease concern. Remove affected leaves and check drainage.',
      urgency:  'high',
      cta:      'Inspect',
      category: 'disease-check',
    };
  }

  if (c.includes('wilt')) {
    return {
      title:    `Water ${label} and check root health`,
      reason:   'Wilting can mean under-watering or root rot. Check soil moisture first.',
      urgency:  'high',
      cta:      'Check root',
      category: 'scan-followup',
    };
  }

  if (c.includes('nutrient') || c.includes('deficien')) {
    return {
      title:    `Consider light feeding for ${label}`,
      reason:   'A recent scan flagged a possible nutrient issue. Add a balanced fertiliser if soil is dry.',
      urgency:  'medium',
      cta:      'Check plant',
      category: 'nutrition',
    };
  }

  if (c === 'healthy') {
    // Positive scan — gentle encouragement, not an alarm.
    return {
      title:    `Keep up the good care for ${label}`,
      reason:   'Your recent scan shows the plant looks healthy. Keep watering and monitoring regularly.',
      urgency:  'low',
      cta:      'Mark as done',
      category: 'scan-followup',
    };
  }

  if (c === 'needs_review') {
    return {
      title:    `Take a closer look at ${label} today`,
      reason:   'Your recent scan flagged something to review. Inspect leaves, stem, and soil.',
      urgency:  'medium',
      cta:      'Inspect',
      category: 'scan-followup',
    };
  }

  // Unknown category — return null so caller falls through to weather/stage rules.
  return null;
}

// ─── Crop-specific intelligence (Weather AI + Crop Stage Engine spec §4) ──
//
// Returns a tuned task for a specific (crop × stage × weather) combo,
// or null if no crop-specific rule fires. Crop-specific rules have
// HIGHER priority than generic weather rules but LOWER priority than
// scan signals — so a recent scan still overrides crop tuning, but
// crop tuning overrides the generic "rain → drainage" default.
//
// All keys map to translation entries in i18n/intelligenceTranslations.js;
// the strings here are the English fallbacks consumed by tSafe at the UI.

function _cropSpecific(ctx, mode) {
  const {
    weatherType, crop, cropStage,
    temp, rainChance, humidityPct, windSpeedKph,
  } = ctx;

  const name  = (typeof crop === 'string' && crop.trim()) ? crop.trim() : '';
  if (!name) return null;
  const c     = name.toLowerCase();
  const stage = _s(cropStage);
  const isFlower  = stage.includes('flower');
  const isFruit   = stage.includes('fruit');
  const isVeg     = stage.includes('vegetative') || stage.includes('growth');
  const isRain    = weatherType === 'rain' || (_n(rainChance) !== null && rainChance >= 60);
  const isHumid   = (_n(humidityPct) !== null && humidityPct >= 75) || isRain;
  const isHot     = weatherType === 'heat' || (_n(temp) !== null && temp >= 32);
  const isDry     = weatherType === 'dry'  || (_n(rainChance) !== null && rainChance <= 20);
  const isWind    = weatherType === 'wind' || (_n(windSpeedKph) !== null && windSpeedKph >= 25);

  // ── Tomato — leaf-spot watch in humid flowering/fruiting ──────────
  if (c.includes('tomato')) {
    if ((isFlower || isFruit) && isHumid) {
      return {
        title:        `Watch ${name} for leaf spots today`,
        titleKey:     'intel.crop.tomato.leafSpot.title',
        reason:       'Humid weather during flowering can raise leaf-spot pressure. Check lower leaves and remove any with spreading marks.',
        reasonKey:    'intel.crop.tomato.leafSpot.reason',
        urgency:      'high',
        cta:          'Inspect leaves',
        category:     'pest-check',
        cropSpecific: 'tomato',
      };
    }
    if (isHot) {
      return {
        title:        `Avoid midday watering for your ${name}`,
        titleKey:     'intel.crop.tomato.heat.title',
        reason:       'Tomato roots stress in midday heat. Water early morning or after sunset, not in direct sun.',
        reasonKey:    'intel.crop.tomato.heat.reason',
        urgency:      'medium',
        cta:          'Mark as done',
        category:     'watering',
        cropSpecific: 'tomato',
      };
    }
  }

  // ── Pepper — leaf curl / moisture stress in heat or flowering ─────
  if (c.includes('pepper') || c.includes('chilli') || c.includes('chili')) {
    if (isHot) {
      return {
        title:        `Check ${name} for leaf curl in the heat`,
        titleKey:     'intel.crop.pepper.heat.title',
        reason:       'Pepper leaves curl when stressed by heat or low moisture. Check soil moisture and provide shade if leaves curl tightly.',
        reasonKey:    'intel.crop.pepper.heat.reason',
        urgency:      'high',
        cta:          'Inspect leaves',
        category:     'pest-check',
        cropSpecific: 'pepper',
      };
    }
    if (isFlower) {
      return {
        title:        `Keep ${name} watering steady during flowering`,
        titleKey:     'intel.crop.pepper.flowering.title',
        reason:       'Pepper drops flowers when watering swings between dry and wet. Aim for steady moisture.',
        reasonKey:    'intel.crop.pepper.flowering.reason',
        urgency:      'medium',
        cta:          'Mark as done',
        category:     'flowering',
        cropSpecific: 'pepper',
      };
    }
  }

  // ── Maize / Corn — wind support + dry-vegetative root-zone check ──
  if (c.includes('maize') || c.includes('corn')) {
    if (isWind) {
      return {
        title:        `Check ${name} stalks for wind damage`,
        titleKey:     'intel.crop.maize.wind.title',
        reason:       'Maize is prone to lodging in strong wind. Inspect tall stalks and stake or hill the base if leaning.',
        reasonKey:    'intel.crop.maize.wind.reason',
        urgency:      'high',
        cta:          'Check stalks',
        category:     'wind',
        cropSpecific: 'maize',
      };
    }
    if (isVeg && isDry) {
      return {
        title:        `Check ${name} root-zone moisture`,
        titleKey:     'intel.crop.maize.vegDry.title',
        reason:       'Vegetative-stage maize needs steady root moisture. Feel the soil 5 cm down and water if dry.',
        reasonKey:    'intel.crop.maize.vegDry.reason',
        urgency:      'high',
        cta:          'Check soil',
        category:     'watering',
        cropSpecific: 'maize',
      };
    }
  }

  // ── Rice — water-level guidance dominates ─────────────────────────
  if (c.includes('rice') || c.includes('paddy')) {
    if (isRain) {
      return {
        title:        `Check ${name} field drainage`,
        titleKey:     'intel.crop.rice.rain.title',
        reason:       'Heavy rain can flood the paddy beyond optimal depth. Check drainage outlets and bunds.',
        reasonKey:    'intel.crop.rice.rain.reason',
        urgency:      'high',
        cta:          'Check field',
        category:     'drainage',
        cropSpecific: 'rice',
      };
    }
    if (isDry || isHot) {
      return {
        title:        `Check ${name} water level`,
        titleKey:     'intel.crop.rice.dry.title',
        reason:       'Rice needs careful water control. Avoid letting the field dry out for long.',
        reasonKey:    'intel.crop.rice.dry.reason',
        urgency:      'high',
        cta:          'Check water',
        category:     'water-level',
        cropSpecific: 'rice',
      };
    }
  }

  // ── Okra — pest pressure on young leaves ──────────────────────────
  if (c.includes('okra') || c.includes('lady')) {
    if (isVeg || isFlower) {
      return {
        title:        `Inspect ${name} leaves for holes or insects`,
        titleKey:     'intel.crop.okra.pest.title',
        reason:       'Young okra leaves and pods attract pests. Check under leaves and along stems.',
        reasonKey:    'intel.crop.okra.pest.reason',
        urgency:      'medium',
        cta:          'Inspect',
        category:     'pest-check',
        cropSpecific: 'okra',
      };
    }
  }

  // ── Cassava — avoid waterlogging ──────────────────────────────────
  if (c.includes('cassava') || c.includes('manioc') || c.includes('yuca')) {
    if (isRain) {
      return {
        title:        `Check drainage around your ${name}`,
        titleKey:     'intel.crop.cassava.rain.title',
        reason:       'Cassava roots rot in waterlogged soil. Check drainage and clear water around the base.',
        reasonKey:    'intel.crop.cassava.rain.reason',
        urgency:      'high',
        cta:          'Check soil',
        category:     'drainage',
        cropSpecific: 'cassava',
      };
    }
    return {
      title:        `Inspect ${name} leaves for yellowing`,
      titleKey:     'intel.crop.cassava.general.title',
      reason:       'Yellowing cassava leaves can signal cassava mosaic or stressed roots. A quick visual check helps catch it early.',
      reasonKey:    'intel.crop.cassava.general.reason',
      urgency:      'medium',
      cta:          'Inspect',
      category:     'pest-check',
      cropSpecific: 'cassava',
    };
  }

  // ── Leafy greens — heat sensitive ─────────────────────────────────
  if (c.includes('lettuce') || c.includes('spinach') || c.includes('cabbage')
      || c.includes('greens') || c.includes('kale') || c.includes('amaranth')) {
    if (isHot) {
      return {
        title:        `Shade or water your ${name} early today`,
        titleKey:     'intel.crop.leafy.heat.title',
        reason:       'Leafy greens wilt fast in heat. Provide partial shade or water before 9 am to keep leaves crisp.',
        reasonKey:    'intel.crop.leafy.heat.reason',
        urgency:      'high',
        cta:          'Water now',
        category:     'watering',
        cropSpecific: 'leafy',
      };
    }
    return {
      title:        `Check under ${name} leaves for pests`,
      titleKey:     'intel.crop.leafy.pest.title',
      reason:       'Leafy greens attract aphids and caterpillars. Lift a few outer leaves and check for damage.',
      reasonKey:    'intel.crop.leafy.pest.reason',
      urgency:      'medium',
      cta:          'Inspect',
      category:     'pest-check',
      cropSpecific: 'leafy',
    };
  }

  // ── Onion — avoid excess moisture ─────────────────────────────────
  if (c.includes('onion') || c.includes('shallot')) {
    if (isRain) {
      return {
        title:        `Improve drainage around your ${name}`,
        titleKey:     'intel.crop.onion.rain.title',
        reason:       'Onions rot in waterlogged soil. Check that water drains away from the bulbs.',
        reasonKey:    'intel.crop.onion.rain.reason',
        urgency:      'high',
        cta:          'Check soil',
        category:     'drainage',
        cropSpecific: 'onion',
      };
    }
    return {
      title:        `Watch ${name} leaf tips for browning`,
      titleKey:     'intel.crop.onion.general.title',
      reason:       'Onion leaf-tip browning can signal water or nutrient stress. A quick check today helps catch it early.',
      reasonKey:    'intel.crop.onion.general.reason',
      urgency:      'medium',
      cta:          'Inspect',
      category:     'pest-check',
      cropSpecific: 'onion',
    };
  }

  return null;
  // void(mode) — kept for future mode-specific crop tuning.
}

// ─── Farm task rules ──────────────────────────────────────────────

/**
 * Derive today's task for farmer mode.
 * Priority: scan → crop-specific → harvest/fruiting → weather → crop stage → fallback.
 */
function _farmTask(ctx) {
  const {
    weatherType, crop, cropStage,
    temp, rainChance, recentScanCategory,
  } = ctx;

  // 'crop' (not 'your crop') — the callers prefix with "your " themselves.
  const name  = _cropName(crop, 'crop');
  const stage = _s(cropStage);

  // 1. Scan followup (highest context signal — farmer acted on it recently)
  if (recentScanCategory) {
    const t = _scanFollowup(recentScanCategory, name, 'farm');
    if (t) return t;
  }

  // 1b. Crop-specific intelligence — fires when (crop × stage × weather)
  //     matches a known nuance (tomato leaf spot in humid flowering,
  //     maize wind lodging, rice flood drainage, etc.).
  const cropTask = _cropSpecific(ctx, 'farm');
  if (cropTask) return cropTask;

  // 2. Harvest / fruiting — market-facing nudge (spec: "harvest stage → Ready to sell?")
  if (stage.includes('harvest') || stage.includes('fruit')) {
    return {
      title:    `Check ${name} harvest readiness`,
      reason:   'Harvest timing affects quality and market price. Look for mature colour, size, and firmness.',
      urgency:  'high',
      cta:      'Check crop',
      category: 'harvest',
    };
  }

  // 3. Weather rules (spec: "rain → drainage task; dry weather → irrigation task")
  const isRain = weatherType === 'rain'
    || (_n(rainChance) !== null && rainChance >= 60);

  if (weatherType === 'heat' && isRain) {
    // Conflicting signals — prioritise rain avoidance
  }

  if (isRain) {
    return {
      title:    `Check drainage around your ${name}`,
      reason:   'Rain is expected — make sure water does not pool around the roots.',
      urgency:  'medium',
      cta:      'Mark as done',
      category: 'weather',
    };
  }

  const isDry = weatherType === 'heat'
    || weatherType === 'dry'
    || (_n(temp) !== null && temp >= 32);

  if (isDry) {
    return {
      title:    `Irrigate your ${name} early morning`,
      reason:   'Hot, dry weather dries soil fast. Water early to protect roots from heat stress.',
      urgency:  'high',
      cta:      'Mark as done',
      category: 'watering',
    };
  }

  if (weatherType === 'wind') {
    return {
      title:    `Check ${name} plants for wind damage`,
      reason:   'Strong wind can uproot or bend young plants. Inspect and stake if needed.',
      urgency:  'medium',
      cta:      'Mark as done',
      category: 'wind',
    };
  }

  if (weatherType === 'cloudy') {
    return {
      title:    `Inspect ${name} for pests or disease`,
      reason:   'Overcast weather raises humidity and pest pressure. A quick check protects the crop.',
      urgency:  'medium',
      cta:      'Inspect',
      category: 'pest-check',
    };
  }

  // 4. Crop stage
  if (stage.includes('flower')) {
    return {
      title:    `Inspect ${name} flowers and leaves`,
      reason:   'Flowering is sensitive. Check for pests, yellowing, or water stress now.',
      urgency:  'high',
      cta:      'Inspect',
      category: 'flowering',
    };
  }

  if (stage.includes('vegetative') || stage.includes('growth')) {
    return {
      title:    `Remove weeds around your ${name}`,
      reason:   'Weeds compete for water and nutrients. Clear them early.',
      urgency:  'medium',
      cta:      'Mark as done',
      category: 'weeding',
    };
  }

  if (stage.includes('seed') || stage.includes('germinat')) {
    return {
      title:    `Keep ${name} seed area lightly moist`,
      reason:   'Seeds need gentle moisture to germinate. Do not overwater.',
      urgency:  'medium',
      cta:      'Mark as done',
      category: 'germination',
    };
  }

  // 5. Fallback
  return { ...FALLBACK_TASK, title: `Check soil moisture around your ${name}` };
}

// ─── Garden task rules ────────────────────────────────────────────

/**
 * Derive today's task for garden / backyard mode.
 * Priority: scan → indoor+low-light → hot+small-container → rain → heat/dry → wind → stage → fallback.
 */
function _gardenTask(ctx) {
  const {
    weatherType, crop, cropStage,
    temp, indoor, containerSize, recentScanCategory,
  } = ctx;

  // 'plant' (not 'your plant') — callers prefix with "your " themselves.
  const name  = _cropName(crop, 'plant');
  const stage = _s(cropStage);

  const isIndoor = indoor === true
    || _s(indoor) === 'indoor'
    || _s(indoor) === 'true';

  const isSmall = _s(containerSize).includes('small')
    || _s(containerSize).includes('pot')
    || _s(containerSize).includes('tiny');

  // 1. Scan followup
  if (recentScanCategory) {
    const t = _scanFollowup(recentScanCategory, name, 'garden');
    if (t) return t;
  }

  // 1b. Crop-specific intelligence — same engine as farm mode but
  //     fires AFTER scan and BEFORE the indoor/container heuristics.
  //     Garden-mode tomato/pepper/leafy benefit from these nuances too.
  const cropTask = _cropSpecific(ctx, 'garden');
  if (cropTask) return cropTask;

  // 2. Indoor + low / no direct light (spec: "indoor + low light → sunlight reminder")
  if (isIndoor && (weatherType === 'cloudy' || weatherType === 'unknown')) {
    return {
      title:    `Rotate ${name} toward the window`,
      reason:   'Indoor plants need 4-6 hours of good light. Rotate so all sides get sun.',
      urgency:  'medium',
      cta:      'Check light',
      category: 'light',
    };
  }

  // 3. Hot weather + small container (spec: "hot weather + small pot → water earlier")
  const isHot = weatherType === 'heat'
    || (_n(temp) !== null && temp >= 30);

  if (isHot && isSmall) {
    return {
      title:    `Water ${name} before 9 am today`,
      reason:   'Small containers dry out quickly in heat. Watering early keeps roots cool.',
      urgency:  'high',
      cta:      'Water now',
      category: 'watering',
    };
  }

  // 4. Rain → pot drainage (spec: garden rain → drainage)
  if (weatherType === 'rain') {
    return {
      title:    `Check ${name} container drainage`,
      reason:   'Rain can waterlog containers without drainage holes. Empty saucers if needed.',
      urgency:  'medium',
      cta:      'Check drainage',
      category: 'drainage',
    };
  }

  // 5. Heat / dry
  if (isHot || weatherType === 'dry') {
    return {
      title:    `Water ${name} early or late today`,
      reason:   'Avoid watering in the hottest part of the day — evaporation wastes water and can scorch leaves.',
      urgency:  'high',
      cta:      'Water now',
      category: 'watering',
    };
  }

  // 6. Wind (outdoor garden only — indoor plants don't face wind)
  if (weatherType === 'wind' && !isIndoor) {
    return {
      title:    `Move ${name} to a sheltered spot`,
      reason:   'Strong wind can snap fragile stems or knock over containers. Shelter or stake now.',
      urgency:  'medium',
      cta:      'Check plant',
      category: 'wind',
    };
  }

  // 7. Sunny outdoor — opportunistic check
  if (weatherType === 'sunny' && !isIndoor) {
    return {
      title:    `Give ${name} a quick check-over`,
      reason:   'Good light conditions today — a brief inspection helps catch early problems.',
      urgency:  'low',
      cta:      'Check plant',
      category: 'crop-care',
    };
  }

  // 8. Crop stage
  if (stage.includes('harvest') || stage.includes('fruit')) {
    return {
      title:    `Your ${name} may be ready to harvest`,
      reason:   'Ripe fruit left too long can drop or over-ripen. Harvest when colour and size look right.',
      urgency:  'high',
      cta:      'Check plant',
      category: 'harvest',
    };
  }

  if (stage.includes('flower')) {
    return {
      title:    `Inspect ${name} flowers`,
      reason:   'Flowering is a critical window. Check for pests, yellowing, or wilting.',
      urgency:  'medium',
      cta:      'Inspect',
      category: 'flowering',
    };
  }

  if (stage.includes('seed') || stage.includes('germinat')) {
    return {
      title:    `Keep ${name} container lightly moist`,
      reason:   'Seedlings need gentle moisture. Use a spray bottle if available.',
      urgency:  'medium',
      cta:      'Check moisture',
      category: 'germination',
    };
  }

  // 9. Fallback
  return {
    title:    `Walk past your ${name} today`,
    reason:   'Feel the soil before watering — water only if it reads dry.',
    urgency:  'medium',
    cta:      'Mark as done',
    category: 'crop-care',
  };
}

// ─── Alert rules ──────────────────────────────────────────────────

/**
 * Return a banner alert when conditions warrant one, else null.
 * Only critical / warning weather conditions produce alerts;
 * routine conditions do not need a banner.
 */
function _buildAlert(ctx) {
  const { weatherType, mode, temp, rainChance, indoor } = ctx;

  const isIndoor = indoor === true || _s(indoor) === 'indoor';

  // Extreme heat
  if (weatherType === 'heat' || (_n(temp) !== null && temp >= 35)) {
    return {
      id:       'ctx.heat',
      title:    'Heat alert',
      message:  mode === 'garden'
        ? 'High heat today. Water containers early and move sensitive plants to shade.'
        : 'High heat can stress your crop. Irrigate early morning and check soil moisture.',
      priority: 'warning',
    };
  }

  // Heavy rain / high chance
  if (weatherType === 'rain' || (_n(rainChance) !== null && rainChance >= 70)) {
    return {
      id:       'ctx.rain',
      title:    'Rain expected',
      message:  mode === 'garden'
        ? 'Rain today — check that containers have clear drainage holes and empty saucers.'
        : 'Rain expected — delay watering and clear any drainage channels.',
      priority: 'info',
    };
  }

  // Strong wind
  if (weatherType === 'wind') {
    return {
      id:       'ctx.wind',
      title:    'Strong wind',
      message:  mode === 'garden'
        ? isIndoor
          ? 'Keep windows closed to protect indoor plants from draught today.'
          : 'Move fragile containers to a sheltered spot before the wind picks up.'
        : 'Avoid spraying today — wind carries product off the crop.',
      priority: 'warning',
    };
  }

  return null;
}

// ─── Recommendation rules ─────────────────────────────────────────

/**
 * Return a mode-aware quick recommendation.
 * Farm mode: market / funding nudge.
 * Garden mode: scan / care nudge.
 * Always returns a non-null object (falls back to FALLBACK_RECOMMENDATION).
 */
function _buildRecommendation(ctx) {
  const { mode, cropStage, weatherType, recentScanCategory } = ctx;
  const stage = _s(cropStage);

  if (mode === 'farm') {
    // Harvest → sell prompt (spec: "harvest stage → Ready to sell?")
    if (stage.includes('harvest') || stage.includes('fruit')) {
      return {
        text:       'Your crop may be ready to sell. List it now and reach buyers early.',
        action:     'View buyers',
        actionPath: '/sell',
        type:       'sell',
      };
    }

    // Dry / heat → highlight funding for irrigation equipment
    if (weatherType === 'heat' || weatherType === 'dry') {
      return {
        text:       'Irrigation funding may be available for your farm. Check opportunities.',
        action:     'See funding',
        actionPath: '/funding',
        type:       'funding',
      };
    }

    // Default farm recommendation — funding discovery
    return {
      text:       'Funding opportunities are available for farms in your region.',
      action:     'Explore funding',
      actionPath: '/funding',
      type:       'funding',
    };
  }

  // Garden mode
  if (recentScanCategory && recentScanCategory !== 'healthy') {
    // Follow a scan with another scan to track progress
    return {
      text:       'Run another scan tomorrow to track how your plant is responding.',
      action:     'Scan plant',
      actionPath: '/scan',
      type:       'scan',
    };
  }

  if (weatherType === 'sunny') {
    return {
      text:       'Good light today — consider repositioning plants that need more sun.',
      action:     null,
      actionPath: null,
      type:       'care',
    };
  }

  return { ...FALLBACK_RECOMMENDATION };
}

// ─── Sell / funding prompt helpers ───────────────────────────────

function _buildSellPrompt(ctx) {
  if (ctx.mode !== 'farm') return null;
  const stage = _s(ctx.cropStage);
  if (!stage.includes('harvest') && !stage.includes('fruit')) return null;
  const name = _cropName(ctx.crop, 'your crop');
  return `Ready to sell your ${name}? Connect with buyers now.`;
}

function _buildFundingPrompt(ctx) {
  if (ctx.mode !== 'farm') return null;
  const stage = _s(ctx.cropStage);
  // Don't show funding prompt at harvest — sell prompt takes precedence.
  if (stage.includes('harvest') || stage.includes('fruit')) return null;
  return 'Funding opportunities are available for your farm. Tap to explore.';
}

// ─── Main export ──────────────────────────────────────────────────

/**
 * computeContextIntelligence(ctx) → ContextIntelligence
 *
 * Pure function. Same input → same output. Never throws.
 * Always returns a fully-populated, non-null object.
 *
 * ctx shape (all fields optional):
 *   mode               'farm' | 'garden'                (default 'farm')
 *   weatherType        'sunny'|'rain'|'cloudy'|'wind'|'heat'|'dry'|'unknown'
 *   temp               number | null                     (°C)
 *   rainChance         number | null                     (0-100)
 *   crop               string | null
 *   cropStage          string | null
 *   region             string | null
 *   indoor             boolean | 'indoor' | 'outdoor' | null
 *   containerSize      string | null  ('small', 'large', 'pot', …)
 *   recentScanCategory string | null  ('yellowing', 'pests', 'disease', …)
 */
export function computeContextIntelligence(ctx) {
  try {
    const safe = (ctx && typeof ctx === 'object') ? ctx : {};

    const mode = safe.mode === 'garden' ? 'garden' : 'farm';

    const enriched = {
      mode,
      weatherType:        _s(safe.weatherType) || 'unknown',
      temp:               _n(safe.temp),
      rainChance:         _n(safe.rainChance),
      crop:               safe.crop        ?? null,
      cropStage:          safe.cropStage   ?? null,
      region:             safe.region      ?? null,
      indoor:             safe.indoor      ?? null,
      containerSize:      safe.containerSize     ?? null,
      recentScanCategory: safe.recentScanCategory ?? null,
    };

    const rawTask       = mode === 'garden' ? _gardenTask(enriched) : _farmTask(enriched);
    const alert         = _buildAlert(enriched);
    const recommendation = _buildRecommendation(enriched);
    const sellPrompt    = _buildSellPrompt(enriched);
    const fundingPrompt = _buildFundingPrompt(enriched);

    // Merge rawTask over FALLBACK_TASK so any accidental undefined field
    // still has a visible value.
    const todayTask = Object.freeze({
      ...FALLBACK_TASK,
      ...rawTask,
    });

    return Object.freeze({
      todayTask,
      alert:          alert ? Object.freeze(alert) : null,
      recommendation: Object.freeze({ ...FALLBACK_RECOMMENDATION, ...recommendation }),
      sellPrompt,
      fundingPrompt,
      source:         'context-engine-v1',
      mode,
    });
  } catch {
    // Absolute failsafe — never block Home render.
    return Object.freeze({
      todayTask:      FALLBACK_TASK,
      alert:          null,
      recommendation: FALLBACK_RECOMMENDATION,
      sellPrompt:     null,
      fundingPrompt:  null,
      source:         'context-engine-fallback',
      mode:           'farm',
    });
  }
}

// ─── Test surface ─────────────────────────────────────────────────

export const _internal = Object.freeze({
  FALLBACK_TASK,
  FALLBACK_RECOMMENDATION,
  _farmTask,
  _gardenTask,
  _scanFollowup,
  _buildAlert,
  _buildRecommendation,
  _buildSellPrompt,
  _buildFundingPrompt,
});
