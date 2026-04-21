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

  markSeeded();

  return {
    seeded: true,
    counts: {
      farms:      farms.length,
      activeFarms: FARMERS.filter((f) => f.active).length,
      issues:     (getAllIssues() || []).length,
      events:     (getEvents() || []).length,
      officers:   DEMO_OFFICERS.length,
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
