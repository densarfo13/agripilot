/**
 * dedupe-translations.mjs — one-shot maintenance: remove duplicate
 * key declarations from src/i18n/translations.js.
 *
 * translations.js is a flat object literal. A key declared twice
 * makes JS silently keep the LAST declaration ("last wins"). This
 * script removes every EARLIER duplicate declaration, keeping the
 * last — which is BEHAVIOR-PRESERVING: every T[key] resolves to
 * exactly the value it did before. The script proves this by
 * importing translations.js before and after and asserting the
 * resolved map is identical key-for-key; if it is not, it restores
 * the original file and exits non-zero.
 *
 * Idempotent — a second run finds nothing to remove.
 *
 *   node scripts/dedupe-translations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'src/i18n/translations.js');

function die(msg) {
  console.error('[dedupe-translations] ABORT — ' + msg);
  process.exit(1);
}

const original = readFileSync(FILE, 'utf8');
const src = original;
const N = src.length;

// ── Locate the object literal ────────────────────────────────
const marker = 'const T = {';
const mi = src.indexOf(marker);
if (mi < 0) die('could not find "const T = {" in translations.js');
const objOpen = mi + marker.length - 1; // index of the opening '{'

// ── String / comment-aware scanners ──────────────────────────
function skipString(idx) {
  const q = src[idx];
  let j = idx + 1;
  while (j < N) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === q) return j + 1;
    j++;
  }
  return N;
}
function skipWsComments(idx) {
  let j = idx;
  while (j < N) {
    const c = src[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { j++; continue; }
    if (c === '/' && src[j + 1] === '/') { while (j < N && src[j] !== '\n') j++; continue; }
    if (c === '/' && src[j + 1] === '*') {
      j += 2;
      while (j < N && !(src[j] === '*' && src[j + 1] === '/')) j++;
      j += 2; continue;
    }
    break;
  }
  return j;
}

// ── Collect every top-level entry { key, start, end } ────────
const entries = [];
let i = objOpen + 1;
let depth = 1;

while (i < N && depth > 0) {
  const c = src[i];
  if (c === '/' && src[i + 1] === '/') { while (i < N && src[i] !== '\n') i++; continue; }
  if (c === '/' && src[i + 1] === '*') {
    i += 2;
    while (i < N && !(src[i] === '*' && src[i + 1] === '/')) i++;
    i += 2; continue;
  }
  if (c === "'" || c === '"' || c === '`') {
    const strEnd = skipString(i);
    if (depth === 1) {
      const after = skipWsComments(strEnd);
      if (src[after] === ':') {
        const key = src.slice(i + 1, strEnd - 1);
        const valStart = skipWsComments(after + 1);
        if (src[valStart] !== '{') {
          die('top-level value for "' + key + '" is not an object — unexpected shape');
        }
        // Brace-match the value object (string/comment aware).
        let k = valStart;
        let local = 0;
        while (k < N) {
          const cc = src[k];
          if (cc === '/' && src[k + 1] === '/') { while (k < N && src[k] !== '\n') k++; continue; }
          if (cc === '/' && src[k + 1] === '*') {
            k += 2;
            while (k < N && !(src[k] === '*' && src[k + 1] === '/')) k++;
            k += 2; continue;
          }
          if (cc === "'" || cc === '"' || cc === '`') { k = skipString(k); continue; }
          if (cc === '{') { local++; k++; continue; }
          if (cc === '}') { local--; k++; if (local === 0) break; continue; }
          k++;
        }
        let end = skipWsComments(k);
        if (src[end] === ',') end += 1;
        entries.push({ key, start: i, end });
        i = end;
        continue;
      }
    }
    i = strEnd;
    continue;
  }
  if (c === '{') { depth++; i++; continue; }
  if (c === '}') { depth--; i++; continue; }
  i++;
}

// ── Identify earlier duplicates (keep the LAST occurrence) ────
const byKey = new Map();
for (const e of entries) {
  if (!byKey.has(e.key)) byKey.set(e.key, []);
  byKey.get(e.key).push(e);
}
const toRemove = [];
for (const [, list] of byKey) {
  if (list.length > 1) {
    // keep the last, drop the rest
    for (let x = 0; x < list.length - 1; x++) toRemove.push(list[x]);
  }
}

if (toRemove.length === 0) {
  console.log('[dedupe-translations] nothing to do — no duplicate keys.');
  process.exit(0);
}

// ── Expand each removal to whole lines, then splice ──────────
function lineStart(idx) {
  let j = idx;
  while (j > 0 && src[j - 1] !== '\n') j--;
  return j;
}
function lineEndExclusive(idx) {
  let j = idx;
  while (j < N && src[j] !== '\n') j++;
  return (j < N) ? j + 1 : j;
}

const ranges = toRemove
  .map((e) => ({ from: lineStart(e.start), to: lineEndExclusive(e.end - 1) }))
  .sort((a, b) => b.from - a.from); // highest offset first

let out = src;
for (const r of ranges) {
  out = out.slice(0, r.from) + out.slice(r.to);
}

writeFileSync(FILE, out, 'utf8');

// ── Verify: the resolved map must be IDENTICAL key-for-key ───
// Evaluate the object literal from BOTH the original and the
// rewritten text in isolated scopes and compare key-for-key.
function evalT(text) {
  // The file is `const T = { ... }; ... export default ...`.
  // Extract `const T = { ... };` and eval it to an object.
  const start = text.indexOf('const T = {');
  // find the matching close of that object + trailing ';'
  let d = 0, p = text.indexOf('{', start), began = false;
  let inStr = null;
  for (; p < text.length; p++) {
    const ch = text[p];
    if (inStr) {
      if (ch === '\\') { p++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && text[p + 1] === '/') { while (p < text.length && text[p] !== '\n') p++; continue; }
    if (ch === '/' && text[p + 1] === '*') { p += 2; while (p < text.length && !(text[p] === '*' && text[p + 1] === '/')) p++; p++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '{') { d++; began = true; }
    else if (ch === '}') { d--; if (began && d === 0) break; }
  }
  const objText = text.slice(text.indexOf('{', start), p + 1);
  // eslint-disable-next-line no-new-func
  return (new Function('return (' + objText + ');'))();
}

let ok = true;
let reason = '';
try {
  const tBefore = evalT(original);
  const tAfter = evalT(out);
  const bk = Object.keys(tBefore).sort();
  const ak = Object.keys(tAfter).sort();
  if (bk.length !== ak.length) {
    ok = false; reason = `key count changed ${bk.length} → ${ak.length}`;
  } else {
    for (let x = 0; x < bk.length; x++) {
      if (bk[x] !== ak[x]) { ok = false; reason = 'key set changed at ' + bk[x]; break; }
      if (JSON.stringify(tBefore[bk[x]]) !== JSON.stringify(tAfter[bk[x]])) {
        ok = false; reason = 'value changed for ' + bk[x]; break;
      }
    }
  }
} catch (e) {
  ok = false; reason = 'eval failed: ' + (e && e.message);
}

if (!ok) {
  writeFileSync(FILE, original, 'utf8'); // restore — never ship a bad file
  die('verification failed (' + reason + ') — translations.js restored unchanged');
}

console.log('[dedupe-translations] removed ' + toRemove.length
  + ' earlier duplicate declaration(s); resolved map verified identical key-for-key.');
