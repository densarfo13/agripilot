#!/usr/bin/env node
/**
 * check-weekly-review-route.mjs — locks the /activity/weekly-review
 * route + Home card mount + page presence + empty-state path.
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

// App.jsx must register the route + lazy-load the page.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('WeeklyReviewPage') < 0)
      fails.push(`${f}: must lazy-load WeeklyReviewPage`);
    if (src.indexOf('/activity/weekly-review') < 0)
      fails.push(`${f}: must register /activity/weekly-review route`);
  }
}

// Home card must mount inside SimpleModeHomeSection.
{
  const f = 'src/components/simpleMode/SimpleModeHomeSection.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('WeeklyReviewHomeCard') < 0)
      fails.push(`${f}: Home must mount <WeeklyReviewHomeCard />`);
  }
}

// Page must carry empty-state branch.
{
  const f = 'src/pages/WeeklyReviewPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('weeklyReview.empty.title') < 0)
      fails.push(`${f}: missing empty-state title`);
    if (src.indexOf('weekly-review-empty') < 0)
      fails.push(`${f}: missing empty-state testId`);
  }
}

// Home card must self-gate on tasks|scans|outcomes > 0.
{
  const f = 'src/components/commandCenter/WeeklyReviewHomeCard.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('tasksCompleted') < 0 || src.indexOf('scansCompleted') < 0
        || src.indexOf('outcomesImproved') < 0)
      fails.push(`${f}: must self-gate on tasks|scans|outcomes`);
  }
}

if (fails.length) {
  console.error('[check:weekly-review-route] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:weekly-review-route] OK');
