#!/usr/bin/env node
/**
 * check-today-engine.mjs — Phase 11 daily-OS gate.
 *
 *   node scripts/check-today-engine.mjs
 *
 * Verifies the wave-11 today-engine runtime is complete:
 *   1. 5 source files present (composite + 4 sub-engines).
 *   2. Each exports the spec'd entry function + constants.
 *   3. useToday hook exported.
 *   4. TodayHeroCard + PriorityTaskList rendered with required testids.
 *   5. App.jsx invokes installTodayEngineGlobal() during boot.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:today-engine]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

const FILES = {
  composite:   'src/runtime/today/index.js',
  ranker:      'src/runtime/today/priorityRanker.js',
  briefing:    'src/runtime/today/dailyBriefing.js',
  streaks:     'src/runtime/today/streakTracker.js',
  achievements:'src/runtime/today/achievementEngine.js',
  hook:        'src/hooks/useToday.js',
  hero:        'src/components/today/TodayHeroCard.jsx',
  priority:    'src/components/today/PriorityTaskList.jsx',
  app:         'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'composite',    sym: 'todayEngine' },
  { src: 'composite',    sym: 'installTodayEngineGlobal' },
  { src: 'composite',    sym: 'TODAY_ENGINE_VERSION' },
  { src: 'composite',    sym: 'endOfDay' },
  { src: 'ranker',       sym: 'rankTasks' },
  { src: 'ranker',       sym: 'TASK_BUCKET' },
  { src: 'briefing',     sym: 'composeMorningBriefing' },
  { src: 'briefing',     sym: 'composeEndOfDaySummary' },
  { src: 'streaks',      sym: 'computeStreaks' },
  { src: 'achievements', sym: 'computeAchievements' },
  { src: 'achievements', sym: 'ACHIEVEMENT' },
  { src: 'hook',         sym: 'useToday' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

const TASK_BUCKETS = ['DO_NOW', 'DO_TODAY', 'CAN_WAIT', 'RECOVERY'];
for (const b of TASK_BUCKETS) {
  if (!new RegExp(b + '\\s*:').test(sources.ranker)) {
    fail('TASK_BUCKET missing: ' + b);
  }
}

const ACHIEVEMENTS = [
  'FIRST_SCAN', 'FIRST_HARVEST', 'THIRTY_DAY_STREAK',
  'DISEASE_PREVENTED', 'HUNDRED_TASKS', 'CONSISTENT_SCANS',
];
for (const a of ACHIEVEMENTS) {
  if (!new RegExp(a + '\\s*:').test(sources.achievements)) {
    fail('ACHIEVEMENT missing: ' + a);
  }
}

const HERO_IDS = ['today-hero-card'];
for (const id of HERO_IDS) {
  if (!sources.hero.includes(id)) fail('TodayHeroCard missing testid: ' + id);
}
// PriorityTaskList — accept either explicit strings or the template-
// literal pattern that produces them at render time.
const LIST_PATTERNS = [
  /today-priority-task-list/,
  /today-priority-bucket-\$\{bucket\}|today-priority-bucket-do_now/,
  /today-priority-bucket-\$\{bucket\}|today-priority-bucket-do_today/,
  /today-priority-bucket-\$\{bucket\}|today-priority-bucket-recovery/,
];
for (const re of LIST_PATTERNS) {
  if (!re.test(sources.priority)) {
    fail('PriorityTaskList missing testid pattern: ' + re.source);
  }
}

if (!/installTodayEngineGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installTodayEngineGlobal() during boot');
}

console.log(HEADER, 'PASS — Phase 11 today-engine runtime complete.');
console.log('  4 sub-engines + composite + hook + 2 UI cards + install wired.');
process.exit(0);
