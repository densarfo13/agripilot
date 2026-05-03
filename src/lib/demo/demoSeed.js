/**
 * demoSeed.js — deterministic demo data seeder.
 *
 *   ensureDemoSeed({ now? }) → { seeded: boolean, counts: {...} }
 *
 * Runs ONCE per local store (idempotent — a second call is a no-op).
 * Only writes when:
 *   • demo mode is on (see src/config/demoMode.js)
 *   • the store is effectively empty — we never overwrite real user
 *     data in production
 *
 * Writes to the existing local-first stores so every downstream
 * reader (farrowayLocal, issueStore, eventLogger) picks up the
 * seed data without any extra plumbing.
 *
 * The seed covers spec §4:
 *   • 18 farmers across 5 regions × 4 crops (Ghana + Nigeria + India)
 *   • mix of active (12) vs inactive (6)
 *   • two farms with incomplete profiles (missing state/crop)
 *   • recent task activity + feedback
 *   • three open/resolved issues with notes
 *   • one notification-dismiss event so the notification module has
 *     something to render
 */

import { isDemoMode } from '../../config/demoMode.js';
import {
  getFarms, saveFarm, setActiveFarmId, getTaskCompletions,
} from '../../store/farrowayLocal.js';
import { getEvents, logEvent } from '../events/eventLogger.js';
import { createIssue, getAllIssues, assignIssue, updateIssueStatus,
         setOfficerRegistry, addIssueNote, ISSUE_STATUS } from '../issues/issueStore.js';
// Demo / Investor Mode §1 + §2 — the existing seed populates the
// NGO/admin view only. Investors viewing the FARMER side hit an
// empty FirstActionGate / Home loop because no garden/farm /
// streak / completion exists in the local stores. The
// `seedFarmerHome` helper below threads minimal sample state into
// every store the farmer Home reads from so a fresh `?demo=1`
// session lands on a fully-populated home screen with primary
// action + sample completion + sample outcome already in place.
import {
  addGarden as _addGarden,
  addFarm   as _addFarm,
  getGardens as _getGardens,
  getFarms   as _getMxFarms,
} from '../../store/multiExperience.js';
import { setOnboardingComplete as _setOnboardingComplete } from '../../utils/onboarding.js';
import {
  getRetentionState as _getRetentionState,
  recordVisit       as _recordVisit,
  recordCompletion  as _recordCompletion,
} from '../retention/streakStore.js';

const SEED_MARK_KEY = 'farroway.demoSeed.done';
const DAY_MS = 24 * 3600 * 1000;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}
function markSeeded() {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(SEED_MARK_KEY, '1'); } catch { /* ignore */ }
}
function isAlreadySeeded() {
  if (!hasStorage()) return false;
  try { return window.localStorage.getItem(SEED_MARK_KEY) === '1'; }
  catch { return false; }
}

/**
 * Deterministic farmer roster. Names are plausible + region-specific
 * so NGO operators can point to the Ghana vs Nigeria vs India split
 * without the demo feeling fake.
 */
const FARMERS = Object.freeze([
  // Ghana — Ashanti region (tropical + wet, cassava heavy)
  { name: 'Ama Mensah',     country: 'GH', state: 'AS', crop: 'maize',   active: true,  size: 2.5, program: 'ngo_ghana_2026' },
  { name: 'Kofi Boateng',   country: 'GH', state: 'AS', crop: 'cassava', active: true,  size: 3.0, program: 'ngo_ghana_2026' },
  { name: 'Akosua Owusu',   country: 'GH', state: 'AS', crop: 'cassava', active: true,  size: 1.5, program: 'ngo_ghana_2026' },
  { name: 'Yaw Appiah',     country: 'GH', state: 'NP', crop: 'sorghum', active: false, size: 4.0, program: 'ngo_ghana_2026' },
  { name: 'Esi Darko',      country: 'GH', state: 'AS', crop: 'tomato',  active: true,  size: 0.8, program: 'ngo_ghana_2026' },
  // Nigeria — Lagos / Kaduna mix
  { name: 'Chinyere Okonkwo', country: 'NG', state: 'LA', crop: 'maize',   active: true,  size: 2.0, program: 'ngo_naija_pilot' },
  { name: 'Ibrahim Musa',     country: 'NG', state: 'KD', crop: 'sorghum', active: true,  size: 5.0, program: 'ngo_naija_pilot' },
  { name: 'Olumide Adebayo',  country: 'NG', state: 'OY', crop: 'cassava', active: false, size: 3.5, program: 'ngo_naija_pilot' },
  { name: 'Fatima Abubakar',  country: 'NG', state: 'KN', crop: 'rice',    active: true,  size: 1.8, program: 'ngo_naija_pilot' },
  { name: 'Tunde Bello',      country: 'NG', state: 'LA', crop: 'tomato',  active: true,  size: 0.6, program: 'ngo_naija_pilot' },
  // India — Punjab (temperate) + Tamil Nadu
  { name: 'Rajesh Kumar',   country: 'IN', state: 'PB', crop: 'wheat',   active: true,  size: 6.0, program: 'india_smallholder' },
  { name: 'Priya Sharma',   country: 'IN', state: 'PB', crop: 'wheat',   active: true,  size: 4.5, program: 'india_smallholder' },
  { name: 'Arun Nair',      country: 'IN', state: 'TN', crop: 'rice',    active: false, size: 2.0, program: 'india_smallholder' },
  { name: 'Meera Iyer',     country: 'IN', state: 'TN', crop: 'banana',  active: true,  size: 1.2, program: 'india_smallholder' },
  { name: 'Sanjay Patel',   country: 'IN', state: 'GJ', crop: 'cotton',  active: false, size: 3.0, program: 'india_smallholder' },
  // Incomplete profiles (intentional — spec §4 "some incomplete profiles")
  { name: 'Grace Asante',   country: 'GH', state: '',   crop: 'maize',   active: false, size: 1.0, program: 'ngo_ghana_2026', incomplete: true },
  { name: 'Nnamdi Eze',     country: 'NG', state: 'AB', crop: '',        active: false, size: 2.5, program: 'ngo_naija_pilot', incomplete: true },
  // One non-program farmer — reflects real-world mix
  { name: 'Sara Johnson',   country: 'US', state: 'CA', crop: 'tomato',  active: true,  size: 0.3, program: null },
]);

const DEMO_OFFICERS = Object.freeze([
  { id: 'ofc_ghana_north',   name: 'Nana Akoto',   regions: ['AS', 'NP'], crops: ['cassava', 'maize'],   programs: ['ngo_ghana_2026'] },
  { id: 'ofc_naija_field',   name: 'Emeka Johnson', regions: ['LA', 'KD', 'KN', 'OY'], crops: ['maize', 'rice', 'sorghum'], programs: ['ngo_naija_pilot'] },
  { id: 'ofc_india_north',   name: 'Vikram Singh',  regions: ['PB', 'GJ'], crops: ['wheat', 'cotton'],    programs: ['india_smallholder'] },
]);

function isStoreEmpty() {
  try {
    return (getFarms() || []).length === 0
        && (getAllIssues() || []).length === 0
        && (getEvents() || []).length === 0;
  } catch { return true; }
}

/**
 * ensureDemoSeed — main entry. Safe to call on app boot; only writes
 * when demo mode is on, the seed hasn't already run, and the store
 * is empty.
 */
export function ensureDemoSeed({ now = Date.now() } = {}) {
  if (!isDemoMode()) return { seeded: false, reason: 'demo_mode_off' };
  if (isAlreadySeeded()) return { seeded: false, reason: 'already_seeded' };
  if (!isStoreEmpty()) return { seeded: false, reason: 'store_not_empty' };

  // Officer registry — routing + NGO insights both key off this.
  setOfficerRegistry([...DEMO_OFFICERS]);

  const farms = [];
  FARMERS.forEach((row, i) => {
    const farm = saveFarm({
      name:       `${row.name.split(' ')[0]}'s Farm`,
      crop:       row.crop || undefined,
      cropLabel:  row.crop ? row.crop.charAt(0).toUpperCase() + row.crop.slice(1) : null,
      country:    row.country,
      countryLabel: { GH: 'Ghana', NG: 'Nigeria', IN: 'India', US: 'United States' }[row.country] || null,
      state:      row.state || undefined,
      stateLabel: row.state || null,
      farmSize:   row.size,
      sizeUnit:   row.country === 'IN' ? 'ACRE' : 'ACRE',
      stage:      row.active ? 'mid_growth' : 'planning',
      program:    row.program,
      setActive:  i === 0,
    });
    if (farm) {
      // Overwrite farmerId to mimic a real per-farmer id.
      farm.farmerId = `u_demo_${i + 1}`;
      farms.push(farm);
    }
  });

  // Activity events for active farmers (recent task_completed +
  // feedback so the NGO dashboard + impact engine have real data).
  farms.forEach((farm, i) => {
    const roster = FARMERS[i];
    if (!roster || !roster.active) return;
    const completedAt = now - ((i % 5) + 1) * DAY_MS;
    logEvent({
      farmId: farm.id, type: 'task_completed',
      payload: { taskId: 'demo.mid.monitor_moisture' },
      timestamp: completedAt,
    });
    if (i % 3 === 0) {
      logEvent({
        farmId: farm.id, type: 'task_feedback',
        payload: { taskId: 'demo.mid.monitor_moisture', feedback: 'yes' },
        timestamp: completedAt + 60_000,
      });
    }
  });

  // One inactive farmer had activity 3 weeks ago — shows up in
  // declining-regions signal without dominating.
  if (farms[3]) {
    logEvent({
      farmId: farms[3].id, type: 'task_completed',
      payload: { taskId: 'demo.legacy' },
      timestamp: now - 21 * DAY_MS,
    });
  }

  // Issues — three stories so the admin queue + officer queue
  // both show real rows.
  const ghFarm = farms.find((f) => f.countryCode === 'GH' && f.crop === 'cassava');
  const ngFarm = farms.find((f) => f.countryCode === 'NG' && f.crop === 'maize');
  const inFarm = farms.find((f) => f.countryCode === 'IN' && f.crop === 'wheat');

  if (ghFarm) {
    const iss = createIssue({
      farmerId: ghFarm.farmerId, farmId: ghFarm.id, farmerName: FARMERS[1].name,
      program: ghFarm.program, location: ghFarm.countryCode, crop: ghFarm.crop,
      issueType: 'pest', severity: 'high',
      description: 'Whitefly spreading on cassava — half the plot affected.',
    });
    if (iss) {
      assignIssue(iss.id, 'ofc_ghana_north', { adminId: 'demo_admin' });
      addIssueNote(iss.id, {
        authorRole: 'field_officer', authorId: 'ofc_ghana_north',
        text: 'Visited on Tuesday. Sprayed west section.',
      });
    }
  }
  if (ngFarm) {
    createIssue({
      farmerId: ngFarm.farmerId, farmId: ngFarm.id, farmerName: FARMERS[5].name,
      program: ngFarm.program, location: ngFarm.countryCode, crop: ngFarm.crop,
      issueType: 'irrigation', severity: 'medium',
      description: 'Water access issues — borehole down for three days.',
    });
  }
  if (inFarm) {
    const iss = createIssue({
      farmerId: inFarm.farmerId, farmId: inFarm.id, farmerName: FARMERS[10].name,
      program: inFarm.program, location: inFarm.countryCode, crop: inFarm.crop,
      issueType: 'disease', severity: 'low',
      description: 'Yellow leaves on wheat — suspected nutrient deficiency.',
    });
    if (iss) {
      assignIssue(iss.id, 'ofc_india_north', { adminId: 'demo_admin' });
      updateIssueStatus(iss.id, ISSUE_STATUS.RESOLVED, {
        authorRole: 'field_officer', authorId: 'ofc_india_north',
      });
    }
  }

  // A dismissed notification event — makes the notification module
  // non-empty and demonstrates dismiss memory works.
  logEvent({
    farmId: farms[0] ? farms[0].id : null,
    type: 'notification_dismissed',
    payload: { notificationId: 'demo.reminder.morning' },
    timestamp: now - 2 * 3600 * 1000,
  });

  // Demo / Investor Mode §1 + §2 — also populate the farmer-side
  // state so opening Home in demo mode lands on a fully-rendered
  // FirstActionGate. Doesn't affect the NGO seed above; pure
  // additive pass with its own try/catch so a failure here can't
  // unwind the NGO seed that already wrote successfully.
  const farmerHome = (() => {
    try { return seedFarmerHome({ now }); }
    catch { return { seeded: false }; }
  })();

  markSeeded();

  return {
    seeded: true,
    counts: {
      farms:      farms.length,
      activeFarms: FARMERS.filter((f) => f.active).length,
      issues:     (getAllIssues() || []).length,
      events:     (getEvents() || []).length,
      officers:   DEMO_OFFICERS.length,
      farmerHome: !!(farmerHome && farmerHome.seeded),
    },
  };
}

/**
 * seedFarmerHome — populate the farmer-side stores so demo mode
 * lands on a fully-rendered Home (spec §1 + §2).
 *
 * Writes:
 *   • `multiExperience.addGarden` — sample garden ("Pepper") so
 *     the experience switcher has both sides represented
 *   • `multiExperience.addFarm`   — sample farm ("Maize") set as
 *     active so FirstActionGate immediately has a context
 *   • `setOnboardingComplete()` — keeps the demo from bouncing
 *     back to onboarding on first paint
 *   • `streakStore.recordCompletion` × 3 with back-dated visits —
 *     creates a 3-day streak so the spec §5 streak line and the
 *     dependency-trust memory line both fire
 *   • `task_completed` event — gives the engine a recent
 *     completion to anchor "Last time, you waited…" reinforcement
 *
 * Idempotent: bails out if multiExperience already has rows so
 * a re-seed doesn't double the gardens/farms list.
 */
export function seedFarmerHome({ now = Date.now() } = {}) {
  // Bail if there's already a real garden / farm — never overwrite
  // an investor's mid-demo state.
  let existingGardens = [];
  let existingFarms   = [];
  try { existingGardens = _getGardens()  || []; } catch { /* ignore */ }
  try { existingFarms   = _getMxFarms()  || []; } catch { /* ignore */ }
  if (existingGardens.length > 0 || existingFarms.length > 0) {
    return { seeded: false, reason: 'already_populated' };
  }

  let gardenRow = null;
  let farmRow   = null;
  try {
    gardenRow = _addGarden({
      name:         'Sample garden',
      crop:         'pepper',
      cropLabel:    'Pepper',
      country:      'GH',
      countryLabel: 'Ghana',
      state:        'AS',
      stateLabel:   'Ashanti',
      growingSetup: 'container',
      gardenSizeCategory: 'small',
      farmType:     'backyard',
    });
  } catch { /* ignore — degrade to farm-only seed */ }
  try {
    farmRow = _addFarm({
      name:         'Sample farm',
      crop:         'maize',
      cropLabel:    'Maize',
      country:      'GH',
      countryLabel: 'Ghana',
      state:        'AS',
      stateLabel:   'Ashanti',
      sizeBucket:   '1to5',
      farmSizeBucket: '1to5',
      farmType:     'small_farm',
    });
  } catch { /* ignore */ }

  // Mark onboarding complete so ProfileGuard / FarmerEntry don't
  // route the demo to setup on cold boot.
  try { _setOnboardingComplete(); } catch { /* ignore */ }

  // Build a 3-day streak by stamping completion on each of the
  // last three calendar days. recordCompletion advances streakDays
  // by 1 when called exactly one day apart; we walk the stamps
  // newest-first via a tiny date wrapper so the helper sees the
  // gaps it expects.
  try {
    const d2 = new Date(now - 2 * DAY_MS);
    const d1 = new Date(now - 1 * DAY_MS);
    const d0 = new Date(now);
    _recordVisit(d2);     _recordCompletion(d2);
    _recordVisit(d1);     _recordCompletion(d1);
    _recordVisit(d0);     _recordCompletion(d0);
  } catch { /* ignore */ }

  // Pre-stamp a recent task_completed event so the userMemory
  // rollup shows healthy reinforcement on the first render.
  try {
    const farmId = (farmRow && farmRow.id) || (gardenRow && gardenRow.id) || null;
    logEvent({
      farmId,
      type:      'task_completed',
      payload:   {
        taskId:    'demo.morning.check',
        taskTitle: 'Check moisture',
      },
      timestamp: now - 2 * 3600 * 1000,
    });
    logEvent({
      farmId,
      type:      'health_feedback_submitted',
      payload:   { healthFeedback: 'yes' },
      timestamp: now - 1 * 3600 * 1000,
    });
  } catch { /* ignore */ }

  return {
    seeded: true,
    counts: {
      garden: gardenRow ? 1 : 0,
      farm:   farmRow   ? 1 : 0,
      streakDays: (() => {
        try { return _getRetentionState().streakDays || 0; }
        catch { return 0; }
      })(),
    },
  };
}

/**
 * resetDemoSeed — wipes the seed marker so the next `ensureDemoSeed`
 * call re-seeds. Intended for operators who want to refresh the
 * demo state between sessions.
 */
export function resetDemoSeed() {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(SEED_MARK_KEY);
    return true;
  } catch { return false; }
}

export const _internal = Object.freeze({
  SEED_MARK_KEY, FARMERS, DEMO_OFFICERS, isStoreEmpty, markSeeded,
});
