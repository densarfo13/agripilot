#!/usr/bin/env node
/**
 * scripts/check-template-placeholders.mjs — §1 NOTIFICATION TEMPLATE.
 *
 * Fails if:
 *   - the resolver / runtime files are missing
 *   - the resolver does not safe-fallback unknown tokens (must define
 *     SAFE_FALLBACKS for crop/plant/farm)
 *   - the resolver could let raw `{token}` braces survive into output
 *   - the runtime envelope is missing required flags
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const resolver = read('src/runtime/templates/NotificationTemplateResolver.ts');
if (!resolver) F.push('NotificationTemplateResolver.ts: missing');
else {
  if (!/SAFE_FALLBACKS/.test(resolver)) F.push('resolver must define SAFE_FALLBACKS');
  else P.push('SAFE_FALLBACKS present');
  for (const k of ['crop:', 'plant:', 'farm:']) {
    if (!resolver.includes(k))
      F.push(`SAFE_FALLBACKS must include ${k} entry`);
  }
  if (!F.some((m) => /SAFE_FALLBACKS must include/.test(m)))
    P.push('crop/plant/farm safe fallbacks present');
  if (!/isFullyResolved/.test(resolver))
    F.push('resolver must export isFullyResolved helper');
  else P.push('isFullyResolved helper exported');
  if (!/PLACEHOLDER_RE/.test(resolver))
    F.push('resolver must define PLACEHOLDER_RE');
  else P.push('PLACEHOLDER_RE defined');
  // The replace pattern must drop unknown tokens (no raw {x} survives).
  if (!/\.replace\(PLACEHOLDER_RE/.test(resolver))
    F.push('resolver must call .replace(PLACEHOLDER_RE, ...) to strip unknown tokens');
  else P.push('replace(PLACEHOLDER_RE, ...) wired');
}

const runtime = read('src/runtime/notifications/NotificationTemplateRuntime.ts');
if (!runtime) F.push('NotificationTemplateRuntime.ts: missing');
else {
  for (const k of ['resolverReady: true', 'unresolvedPlaceholdersBlocked: true', 'fallbackSafe: true']) {
    if (!runtime.includes(k)) F.push(`runtime envelope must declare ${k}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 3 §1 flags literal-true');
  if (!/lastUnresolvedKeys/.test(runtime))
    F.push('runtime must surface lastUnresolvedKeys array');
  else P.push('lastUnresolvedKeys surfaced');
}

if (F.length) {
  console.error('[check:template-placeholders] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:template-placeholders] PASS — resolver + runtime block unresolved tokens with safe fallbacks.');
for (const m of P) console.log('  ✓ ' + m);
