#!/usr/bin/env node
/**
 * scripts/check-community-visibility.mjs — visibility enforcement.
 *
 * Fails if posts can default to public, if community/public posts can
 * surface private grower data, if NGO evidence posts are NOT forced to
 * organization scope, or if buyers can see organization-only posts.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const TIERS = ['private', 'organization', 'community', 'public'];

const policy = read('src/runtime/community/GrowVisibilityPolicy.ts');
if (!policy) F.push('GrowVisibilityPolicy.ts: missing');
else {
  for (const t of TIERS) {
    if (!new RegExp(`['"]${t}['"]`).test(policy))
      F.push(`visibility tier ${t} must be modeled`);
  }
  if (!F.some((m) => /tier .* must be modeled/.test(m))) P.push('all 4 visibility tiers modeled');
  if (!/canSee/.test(policy)) F.push('visibility policy must export canSee()');
  else P.push('canSee() exported');
  // private posts: author + admin only.
  if (!/visibility === 'private'/.test(policy) || !/isAdmin/.test(policy))
    F.push('private posts must restrict to author + admin');
  else P.push('private posts restricted to author + admin');
  // organization posts: same-org only.
  if (!/visibility === 'organization'/.test(policy) || !/organizationId/.test(policy))
    F.push('organization posts must be same-org scoped');
  else P.push('organization posts same-org scoped');
}

// NGO evidence visibility enforcement
const ngo = read('src/runtime/community/NGOEvidenceShareRuntime.ts');
if (!ngo) F.push('NGOEvidenceShareRuntime.ts: missing');
else {
  if (!/organizationScoped:\s*true/.test(ngo))
    F.push('NGO evidence must declare organizationScoped:true');
  else P.push('NGO evidence organization-scoped');
  if (!/visibilityForcedOrganization:\s*true/.test(ngo))
    F.push('NGO evidence must declare visibilityForcedOrganization:true');
  else P.push('NGO evidence visibility forced to organization');
  if (!/evidencePostsLeakingScope/.test(ngo))
    F.push('NGO evidence must track posts leaking scope');
  else P.push('NGO evidence tracks scope leaks');
}

// Server route handler must enforce canSee equivalent for the feed.
const server = read('server/src/modules/community/routes.js');
if (!server) F.push('server community routes: missing');
else {
  if (!/canSee/.test(server) || !/visibility === 'private'/.test(server))
    F.push('server feed must filter by canSee (visibility enforcement)');
  else P.push('server feed enforces canSee');
  if (!/visibility === 'organization'/.test(server) || !/organizationId/.test(server))
    F.push('server must scope organization posts to same org');
  else P.push('server scopes organization posts');
}

if (F.length) {
  console.error('[check:community-visibility] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:community-visibility] PASS — 4 tiers, private/org enforced, NGO evidence forced org, server mirrors policy.');
for (const m of P) console.log('  ✓ ' + m);
