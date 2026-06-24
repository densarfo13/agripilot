/**
 * check-review-queue.mjs — sprint #214 §12.
 * Fails build if the review queue is missing or Recent Scans doesn't
 * filter to trusted scans + show a Review Queue count.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _exists = (r) => { try { return fs.existsSync(path.join(ROOT, r)); } catch { return false; } };
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const Q = 'src/runtime/scanReview/ScanReviewQueue.ts';
if (!_exists(Q)) errors.push('missing: ' + Q);
else {
  const s = _read(Q);
  _has(s, 'export function addToReviewQueue', 'must export addToReviewQueue');
  _has(s, 'export function reviewQueueCount', 'must export reviewQueueCount');
  for (const st of ['pending_review', 'reviewed', 'discarded', 'promoted_to_plant']) {
    _has(_read('src/runtime/scanReview/ScanReviewContracts.ts'), st, 'review status missing: ' + st);
  }
  _has(s, '__scanReviewQueueHealth', 'must pin __scanReviewQueueHealth');
}
// Recent Scans must filter trusted + show review count.
const RS = 'src/components/scan/RecentScansCard.jsx';
if (!_exists(RS)) errors.push('missing: ' + RS);
else {
  const s = _read(RS);
  _has(s, 'evaluateScanTrust', 'RecentScansCard must filter rows via evaluateScanTrust');
  _has(s, 'recent-scans-review-queue', 'RecentScansCard must show Review Queue count');
}
if (errors.length) {
  console.error('[check:review-queue] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:review-queue] PASS — review queue present; Recent Scans trusted-only + review count.');
