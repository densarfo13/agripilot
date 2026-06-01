#!/usr/bin/env node
/**
 * scripts/check-grow-share-artifacts.mjs — §9 OODA + artifacts.
 *
 * Fails if:
 *   - The 8 spec artifact kinds aren't enumerated
 *   - artifacts bypass ArtifactRuntime
 *   - idempotency keys not enforced
 *   - OODA composite auto-diagnoses from community posts (must require
 *     an explicit user scan)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const KINDS = ['GrowPostCreated', 'GrowPostShared', 'GrowPostUpdated', 'GrowPostDeleted',
  'GrowPostReported', 'CommentCreated', 'LikeCreated', 'NGOEvidenceShared'];

const composite = read('src/runtime/community/GrowShareCompositeRuntime.ts');
if (!composite) F.push('GrowShareCompositeRuntime.ts: missing');
else {
  const missing = KINDS.filter((k) => !composite.includes(k));
  if (missing.length) F.push(`artifact kinds missing: ${missing.join(', ')}`);
  else P.push('all 8 artifact kinds enumerated');
  for (const k of ['artifactRuntimeOnly: true', 'idempotent: true', 'offlineSafe: true', 'nonBlocking: true']) {
    if (!composite.includes(k)) F.push(`composite must declare ${k}`);
  }
  if (!F.some((m) => /composite must declare/.test(m)))
    P.push('artifactRuntimeOnly + idempotent + offlineSafe + nonBlocking');
  if (!/idempotencyKey/.test(composite))
    F.push('artifact composite must check idempotencyKey on every entry');
  else P.push('idempotencyKey checked on every artifact');
  if (!/duplicateArtifactsPrevented/.test(composite))
    F.push('composite must surface duplicateArtifactsPrevented');
  else P.push('duplicateArtifactsPrevented surfaced');
  // OODA must NOT auto-diagnose from community posts.
  if (!/autoDiagnoseFromCommunityPosts:\s*false/.test(composite))
    F.push('OODA must declare autoDiagnoseFromCommunityPosts:false');
  else P.push('OODA does not auto-diagnose from community posts');
  if (!/requiresExplicitScanForDiagnosis:\s*true/.test(composite))
    F.push('OODA must require explicit scan for diagnosis');
  else P.push('explicit scan required for diagnosis');
  if (!/nonBlocking:\s*true/.test(composite) || !/growerSafe:\s*true/.test(composite))
    F.push('OODA composite must be nonBlocking + growerSafe');
  else P.push('OODA nonBlocking + growerSafe');
}

// Share button + feed must record artifacts via the local artifact log
// (ArtifactRuntime-routed) and never call the network directly except
// through the documented /api/community/* endpoints.
const btn = read('src/components/community/ShareUpdateButton.jsx');
if (!btn) F.push('ShareUpdateButton.jsx: missing');
else {
  if (!/_appendArtifact/.test(btn) || !/GrowPostCreated/.test(btn))
    F.push('share button must record GrowPostCreated artifact');
  else P.push('share button records GrowPostCreated artifact');
  if (!/idempotencyKey/.test(btn))
    F.push('share button must attach an idempotencyKey to each post');
  else P.push('share button attaches idempotencyKey');
  // No direct DB writes from the UI — only fetch to /api/community/*.
  const apiCalls = (btn.match(/fetch\(['"`]([^'"`]+)/g) || []).map((m) => m.replace(/^fetch\(['"`]/, ''));
  const stray = apiCalls.filter((u) => !u.startsWith('/api/community/'));
  if (stray.length)
    F.push(`share button must only call /api/community/*; found: ${stray.join(', ')}`);
  else P.push('share button only calls /api/community/* (no direct DB)');
}

if (F.length) {
  console.error('[check:grow-share-artifacts] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:grow-share-artifacts] PASS — 8 artifact kinds, idempotent, no auto-diagnosis, ArtifactRuntime-only.');
for (const m of P) console.log('  ✓ ' + m);
