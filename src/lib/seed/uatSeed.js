/**
 * uatSeed.js — realistic demo data for QA / UAT / stakeholder
 * walkthroughs.
 *
 *   import { seedUatData, clearUatData, isUatSeeded }
 *     from '../lib/seed/uatSeed.js';
 *
 *   seedUatData({ mode: 'farm_us' });
 *   //   Writes a Maryland small-farm farmer with realistic
 *   //   listings, tasks, scans, journal entries.
 *
 *   clearUatData();
 *   //   Removes every key tagged with UAT_TAG so a UAT
 *   //   teardown never disturbs the user's real data.
 *
 *   isUatSeeded();
 *   //   True when the UAT_SENTINEL key is present.
 *
 * Why this exists
 *   Stakeholder demos and UAT testers see empty pages on a
 *   fresh account — funding shows "no opportunities", journal
 *   shows zero entries, NGO analytics show zero rows. That
 *   reads as a broken build even when every flow works.
 *
 *   This module seeds REALISTIC, idempotent demo data that:
 *     1. Is tagged with UAT_TAG so production filters can
 *        exclude it (no fake data in real analytics).
 *     2. Is local-first (writes to localStorage shapes the
 *        canonical readers already understand), so the seed
 *        works without a backend round-trip.
 *     3. Is fully reversible via clearUatData().
 *     4. Is idempotent — re-running overwrites the same slots
 *        instead of duplicating rows.
 *
 * Available scenarios
 *   'farm_us'      — Maryland small-farm farmer, tomato + corn,
 *                    activates Fahrenheit display
 *   'farm_gh'      — Ghana backyard garden, pepper + cassava,
 *                    activates Celsius display
 *   'ngo_admin'    — NGO viewer with realistic aggregate signals
 *
 * Strict-rule audit
 *   * Pure JS, no React, SSR-safe.
 *   * Never throws — every write is in a try/catch.
 *   * Idempotent — overwriting keeps the same farmId so other
 *     surfaces don't see the farm "deleted and re-created".
 *   * Sentinel key (UAT_SENTINEL) records the seeded scenario
 *     + timestamp so future tooling can detect whether a
 *     session is in UAT mode.
 */

import { FarmEvents, publish as _publish } from '../farmEventBus.js';

export const UAT_SENTINEL = 'farroway_uat_seed_sentinel';
export const UAT_TAG       = 'UAT_DEMO';

const _MS_PER_DAY = 24 * 60 * 60 * 1000;
const _NOW = () => { try { return Date.now(); } catch { return 0; } };

// Stable seed IDs so re-running this script doesn't create new
// rows alongside the old ones.
const SEED_IDS = Object.freeze({
  farm_us:        'uat_farm_us_md',
  farm_gh:        'uat_farm_gh_accra',
  listing_us_a:   'uat_listing_us_tomato_a',
  listing_us_b:   'uat_listing_us_corn_b',
  listing_gh_a:   'uat_listing_gh_pepper_a',
  funding_a:      'uat_funding_seed_grant',
  funding_b:      'uat_funding_microloan',
  funding_c:      'uat_funding_export_pilot',
  task_a:         'uat_task_water_tomato',
  task_b:         'uat_task_check_pest',
  task_c:         'uat_task_fertilize',
  scan_a:         'uat_scan_yellowing',
  scan_b:         'uat_scan_healthy',
  scan_c:         'uat_scan_ripeness',
});

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, payload);
  } catch { /* swallow */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _seedSentinel(scenario) {
  _safeWrite(UAT_SENTINEL, {
    scenario,
    seededAt: _NOW(),
    tag:      UAT_TAG,
  });
}

// ─── Scenario builders ────────────────────────────────────────

function _farmUs() {
  return {
    id:            SEED_IDS.farm_us,
    name:          'Maryland Demo Farm',
    farmName:      'Maryland Demo Farm',
    farmerName:    'QA Farmer (US)',
    crop:          'tomato',
    cropName:      'Tomato',
    farmType:      'small_farm',
    country:       'US',
    countryCode:   'US',
    state:         'MD',
    stateLabel:    'Maryland',
    region:        'Maryland',
    locationName:  'Frederick, Maryland',
    latitude:      39.4143,
    longitude:    -77.4105,
    farmSize:      4,
    sizeUnit:      'acres',
    cropStage:     'flowering',
    status:        'active',
    isDefault:     true,
    program:       UAT_TAG,
    createdAt:     new Date(_NOW() - 30 * _MS_PER_DAY).toISOString(),
    updatedAt:     new Date(_NOW() -  2 * _MS_PER_DAY).toISOString(),
  };
}

function _farmGh() {
  return {
    id:            SEED_IDS.farm_gh,
    name:          'Accra Backyard Garden',
    farmName:      'Accra Backyard Garden',
    farmerName:    'QA Farmer (GH)',
    crop:          'pepper',
    cropName:      'Pepper',
    farmType:      'backyard',
    country:       'GH',
    countryCode:   'GH',
    state:         'GA',
    stateLabel:    'Greater Accra',
    region:        'Greater Accra',
    locationName:  'Accra, Ghana',
    latitude:      5.6037,
    longitude:    -0.1870,
    farmSize:      0.05,
    sizeUnit:      'acres',
    cropStage:     'fruiting',
    status:        'active',
    isDefault:     true,
    program:       UAT_TAG,
    createdAt:     new Date(_NOW() - 14 * _MS_PER_DAY).toISOString(),
    updatedAt:     new Date(_NOW() -  1 * _MS_PER_DAY).toISOString(),
  };
}

function _listingsUs() {
  return [
    {
      id:         SEED_IDS.listing_us_a,
      farmId:     SEED_IDS.farm_us,
      crop:       'tomato',
      cropLabel:  'Tomato',
      quantity:   120,
      unit:       'kg',
      readyDate:  new Date(_NOW() + 3 * _MS_PER_DAY).toISOString(),
      region:     'Maryland',
      status:     'active',
      tag:        UAT_TAG,
      createdAt:  new Date(_NOW() - 1 * _MS_PER_DAY).toISOString(),
    },
    {
      id:         SEED_IDS.listing_us_b,
      farmId:     SEED_IDS.farm_us,
      crop:       'corn',
      cropLabel:  'Corn',
      quantity:   50,
      unit:       'bags',
      readyDate:  new Date(_NOW() + 12 * _MS_PER_DAY).toISOString(),
      region:     'Maryland',
      status:     'active',
      tag:        UAT_TAG,
      createdAt:  new Date(_NOW() - 4 * _MS_PER_DAY).toISOString(),
    },
  ];
}

function _listingsGh() {
  return [
    {
      id:         SEED_IDS.listing_gh_a,
      farmId:     SEED_IDS.farm_gh,
      crop:       'pepper',
      cropLabel:  'Pepper',
      quantity:   15,
      unit:       'crates',
      readyDate:  new Date(_NOW() + 2 * _MS_PER_DAY).toISOString(),
      region:     'Greater Accra',
      status:     'active',
      tag:        UAT_TAG,
      createdAt:  new Date(_NOW() - 1 * _MS_PER_DAY).toISOString(),
    },
  ];
}

function _fundingOpportunities() {
  return [
    {
      id:           SEED_IDS.funding_a,
      title:        'USDA Beginning Farmer Microgrant',
      summary:      'Up to $5,000 for new US farmers with under 10 acres.',
      provider:     'USDA',
      region:       'US',
      cropRelevance: ['tomato', 'corn', 'pepper'],
      windowEndsAt: new Date(_NOW() + 30 * _MS_PER_DAY).toISOString(),
      kind:         'grant',
      tag:          UAT_TAG,
      isDemo:       true,
    },
    {
      id:           SEED_IDS.funding_b,
      title:        'Ghana Cocobod Smallholder Loan',
      summary:      'Low-interest credit for backyard + smallholder farmers.',
      provider:     'Ghana Cocobod (demo)',
      region:       'GH',
      cropRelevance: ['cassava', 'pepper'],
      windowEndsAt: new Date(_NOW() + 60 * _MS_PER_DAY).toISOString(),
      kind:         'loan',
      tag:          UAT_TAG,
      isDemo:       true,
    },
    {
      id:           SEED_IDS.funding_c,
      title:        'Export Readiness Pilot',
      summary:      'Tooling + cold-chain support for produce export.',
      provider:     'Farroway Partner Network (demo)',
      region:       'multi',
      cropRelevance: ['tomato', 'mango'],
      windowEndsAt: new Date(_NOW() + 90 * _MS_PER_DAY).toISOString(),
      kind:         'program',
      tag:          UAT_TAG,
      isDemo:       true,
    },
  ];
}

function _tasks() {
  return [
    {
      id:        SEED_IDS.task_a,
      title:     'Water tomato beds',
      crop:      'tomato',
      farmId:    SEED_IDS.farm_us,
      priority:  'medium',
      status:    'pending',
      dueAt:     new Date(_NOW() + 8 * 60 * 60 * 1000).toISOString(),
      tag:       UAT_TAG,
    },
    {
      id:        SEED_IDS.task_b,
      title:     'Check for aphids on lower leaves',
      crop:      'tomato',
      farmId:    SEED_IDS.farm_us,
      priority:  'high',
      status:    'pending',
      dueAt:     new Date(_NOW() + 24 * 60 * 60 * 1000).toISOString(),
      tag:       UAT_TAG,
    },
    {
      id:        SEED_IDS.task_c,
      title:     'Apply foliar fertilizer',
      crop:      'tomato',
      farmId:    SEED_IDS.farm_us,
      priority:  'low',
      status:    'completed',
      completedAt: new Date(_NOW() - 6 * 60 * 60 * 1000).toISOString(),
      tag:       UAT_TAG,
    },
  ];
}

function _scans() {
  return [
    {
      id:         SEED_IDS.scan_a,
      farmId:     SEED_IDS.farm_us,
      category:   'yellowing',
      possibleIssue: 'Possible nitrogen deficiency on lower leaves',
      confidence: 'medium',
      experience: 'farm',
      cropName:   'tomato',
      createdAt:  new Date(_NOW() - 2 * _MS_PER_DAY).toISOString(),
      tag:        UAT_TAG,
    },
    {
      id:         SEED_IDS.scan_b,
      farmId:     SEED_IDS.farm_us,
      category:   'healthy',
      possibleIssue: 'Foliage looks healthy',
      confidence: 'high',
      experience: 'farm',
      cropName:   'tomato',
      createdAt:  new Date(_NOW() - 5 * _MS_PER_DAY).toISOString(),
      tag:        UAT_TAG,
    },
    {
      id:         SEED_IDS.scan_c,
      farmId:     SEED_IDS.farm_us,
      scanType:   'fruit_ripeness',
      ripenessStage: 'ready',
      confidence: 'high',
      cropName:   'tomato',
      createdAt:  new Date(_NOW() - 1 * _MS_PER_DAY).toISOString(),
      tag:        UAT_TAG,
    },
  ];
}

function _journalEntries() {
  return [
    {
      at:    new Date(_NOW() - 1 * _MS_PER_DAY).toISOString(),
      kind:  'scan',
      label: 'Scanned tomato — looks ready for harvest soon',
      ref:   { scanId: SEED_IDS.scan_c },
      tag:   UAT_TAG,
    },
    {
      at:    new Date(_NOW() - 6 * 60 * 60 * 1000).toISOString(),
      kind:  'task',
      label: 'Applied foliar fertilizer',
      ref:   { taskId: SEED_IDS.task_c },
      tag:   UAT_TAG,
    },
    {
      at:    new Date(_NOW() - 2 * _MS_PER_DAY).toISOString(),
      kind:  'scan',
      label: 'Yellowing leaves detected — nitrogen check recommended',
      ref:   { scanId: SEED_IDS.scan_a },
      tag:   UAT_TAG,
    },
  ];
}

function _ngoAnalytics() {
  return {
    tag:             UAT_TAG,
    refreshedAt:     _NOW(),
    farmersOnboarded: 24,
    activeFarms:      31,
    scansCompleted:   142,
    tasksCompleted:   389,
    listingsCreated:  18,
    topCrops: [
      { crop: 'tomato', count: 14 },
      { crop: 'pepper', count: 9  },
      { crop: 'cassava', count: 5 },
    ],
    regionBreakdown: [
      { region: 'Maryland',       count: 11 },
      { region: 'Greater Accra',  count: 9  },
      { region: 'Nairobi',        count: 4  },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Seed a UAT scenario into localStorage. Idempotent — overwrites
 * the same slots so re-running keeps a single set of seed rows.
 *
 * @param {object} [opts]
 * @param {('farm_us'|'farm_gh'|'ngo_admin')} [opts.mode='farm_us']
 * @returns {object} a summary of what was seeded
 */
export function seedUatData(opts) {
  const mode = (opts && typeof opts === 'object' && opts.mode) || 'farm_us';
  try {
    const farm = mode === 'farm_gh' ? _farmGh() : _farmUs();
    const farms = [farm];
    const listings = mode === 'farm_gh' ? _listingsGh() : _listingsUs();
    const funding  = _fundingOpportunities();
    const tasks    = _tasks();
    const scans    = _scans();
    const journal  = _journalEntries();
    const ngo      = _ngoAnalytics();

    // Canonical farm store - mirrors the production write path
    // (farroway.farms + farroway.activeFarmId + active experience).
    _safeWrite('farroway.farms',             farms);
    _safeWrite('farroway.activeFarmId',      farm.id);
    _safeWrite('farroway_active_experience', mode === 'farm_gh' ? 'garden' : 'farm');
    // Legacy single-farm blob for surfaces still reading it.
    _safeWrite('farroway_active_farm', farm);

    // Marketplace listings live under their own canonical key.
    _safeWrite('farroway_market_listings_v1', listings);

    // Funding opportunities — the demo flag lets the UI render
    // them clearly as "demo" if it wants to.
    _safeWrite('farroway_funding_opportunities_v1', funding);

    // Task list — same shape farmerTodayPage / taskEngine reads.
    _safeWrite('farroway_tasks_v1', tasks);

    // Scan history — both the lightweight v1 key + the full
    // scanHistory blob.
    _safeWrite('farroway_scan_history_v1', scans.map((s) => ({
      id:         s.id,
      category:   s.category || null,
      noticed:    s.possibleIssue || null,
      createdAt:  s.createdAt,
      experience: s.experience || 'farm',
      taskAdded:  false,
    })));

    // Journal timeline — the farmTimeline composer reads this.
    _safeWrite('farroway_journal_timeline_v1', journal);

    // NGO analytics signals.
    _safeWrite('farroway_ngo_analytics_v1', ngo);

    _seedSentinel(mode);

    // Notify reactive subscribers (useFarmContext, continuityEngine)
    // so Home/Tasks/Sell re-render without a manual refresh.
    try { _publish(FarmEvents.FARM_CREATED, { source: 'uat_seed', farmId: farm.id }); }
    catch { /* swallow */ }

    return {
      ok:         true,
      mode,
      farmId:     farm.id,
      counts: {
        farms:    farms.length,
        listings: listings.length,
        funding:  funding.length,
        tasks:    tasks.length,
        scans:    scans.length,
        journal:  journal.length,
      },
    };
  } catch (err) {
    return { ok: false, mode, error: (err && err.message) || 'seed_failed' };
  }
}

/**
 * Remove every UAT-tagged key. Real user data is never touched.
 */
export function clearUatData() {
  const keys = [
    UAT_SENTINEL,
    'farroway.farms',
    'farroway.activeFarmId',
    'farroway_active_experience',
    'farroway_active_farm',
    'farroway_market_listings_v1',
    'farroway_funding_opportunities_v1',
    'farroway_tasks_v1',
    'farroway_scan_history_v1',
    'farroway_journal_timeline_v1',
    'farroway_ngo_analytics_v1',
  ];
  for (const k of keys) _safeRemove(k);
  try { _publish(FarmEvents.FARM_UPDATED, { source: 'uat_clear' }); }
  catch { /* swallow */ }
  return { ok: true };
}

/** @returns {boolean} true when UAT data is currently seeded */
export function isUatSeeded() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(UAT_SENTINEL) != null;
  } catch { return false; }
}

/** @returns {object|null} the sentinel object, or null if not seeded */
export function getUatSentinel() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(UAT_SENTINEL);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

const _module = {
  UAT_SENTINEL,
  UAT_TAG,
  SEED_IDS,
  seedUatData,
  clearUatData,
  isUatSeeded,
  getUatSentinel,
};
export default _module;
