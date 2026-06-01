#!/usr/bin/env node
/**
 * check-weekly-review-real-events.mjs — Weekly Review page must
 * consume real artifacts only. Fails if the page or runtime fabricates
 * counts / trends / metrics.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

// Page must consume __weeklyFarmReviewHealth ONLY.
{
  const f = 'src/pages/WeeklyReviewPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('__weeklyFarmReviewHealth') < 0)
      fails.push(`${f}: must read window.__weeklyFarmReviewHealth`);
    // Forbid any literal hardcoded counts in the page that would
    // surface as "fake metrics".
    if (/=\s*['"]?\d{2,}\s+tasks\s+completed/i.test(src))
      fails.push(`${f}: appears to hardcode a count (e.g. "6 tasks completed")`);
    if (src.indexOf('data-consumes="weeklyReview"') < 0)
      fails.push(`${f}: missing data-consumes="weeklyReview" marker`);
  }
}

// Runtime must declare noFakeMetrics / noFabricatedTrends literal-true.
{
  const f = 'src/runtime/command-center/WeeklyFarmReviewRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('noFakeMetrics: true as const') < 0)
      fails.push(`${f}: must declare noFakeMetrics: true as const`);
    if (src.indexOf('noFabricatedTrends: true as const') < 0)
      fails.push(`${f}: must declare noFabricatedTrends: true as const`);
  }
}

// Page-level diagnostic must declare realEventsOnly.
{
  const f = 'src/runtime/command-center/WeeklyReviewPageRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('realEventsOnly: true as const') < 0)
      fails.push(`${f}: must declare realEventsOnly: true as const`);
  }
}

if (fails.length) {
  console.error('[check:weekly-review-real-events] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:weekly-review-real-events] OK');
