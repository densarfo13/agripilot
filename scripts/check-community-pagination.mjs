#!/usr/bin/env node
/**
 * scripts/check-community-pagination.mjs — feed pagination + rate limits.
 *
 * Fails if:
 *   - /community feed has no pagination (no Show more, no page size bound)
 *   - server feed has no page+limit query parameters
 *   - comments / reports endpoints are not rate-limited
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Client feed page must paginate.
const feed = read('src/pages/CommunityFeedPage.jsx');
if (!feed) F.push('CommunityFeedPage.jsx: missing');
else {
  if (!/PAGE_SIZE/.test(feed)) F.push('feed must define a PAGE_SIZE constant');
  else P.push('feed defines PAGE_SIZE');
  if (!/Show more|showMore|community-show-more/.test(feed))
    F.push('feed must expose a Show-more pagination control (no infinite scroll)');
  else P.push('feed has Show-more pagination');
  if (!/page=\$\{page\}|[?&]page=/.test(feed))
    F.push('feed must request paginated API (page param)');
  else P.push('feed requests paginated API');
}

// Server feed must accept page + limit + cap MAX_PAGE_SIZE.
const server = read('server/src/modules/community/routes.js');
if (!server) F.push('server community routes: missing');
else {
  if (!/req\.query\.page/.test(server) || !/req\.query\.limit/.test(server))
    F.push('server feed must accept page + limit query params');
  else P.push('server feed accepts page + limit');
  if (!/MAX_PAGE_SIZE/.test(server))
    F.push('server must cap pagination at MAX_PAGE_SIZE');
  else P.push('server caps pagination at MAX_PAGE_SIZE');
  // Rate limiters on comment + report.
  if (!/commentLimiter/.test(server) || !/rateLimit\s*\(\s*\{[\s\S]*?max:\s*20/.test(server))
    F.push('comments must be rate-limited (max 20/10min)');
  else P.push('comments rate-limited (20/10min)');
  if (!/reportLimiter/.test(server) || !/max:\s*5/.test(server))
    F.push('reports must be rate-limited (max 5/10min)');
  else P.push('reports rate-limited (5/10min)');
}

// Interaction runtime must attest the same rate limits client-side.
const inter = read('src/runtime/community/CommunityInteractionRuntime.ts');
if (!inter) F.push('CommunityInteractionRuntime.ts: missing');
else {
  if (!/MAX_COMMENTS_PER_WINDOW\s*=\s*20/.test(inter))
    F.push('interaction runtime must declare MAX_COMMENTS_PER_WINDOW=20');
  else P.push('interaction max comments = 20');
  if (!/MAX_REPORTS_PER_WINDOW\s*=\s*5/.test(inter))
    F.push('interaction runtime must declare MAX_REPORTS_PER_WINDOW=5');
  else P.push('interaction max reports = 5');
}

if (F.length) {
  console.error('[check:community-pagination] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:community-pagination] PASS — feed paginates, server caps page size, comments+reports rate-limited.');
for (const m of P) console.log('  ✓ ' + m);
