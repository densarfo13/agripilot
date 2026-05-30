#!/usr/bin/env node
/**
 * scripts/clean-build-artifacts.mjs — Wave-23.
 *
 * Removes stale build artifacts BEFORE build:safe runs so the
 * fresh build doesn't inherit a partially-stale dist directory
 * (which has masked CI gate failures in past waves).
 *
 * Targets — only these three, NEVER anything else:
 *   • dist/                        (Vite's final output)
 *   • .vite/                       (Vite's project-local cache)
 *   • node_modules/.vite/          (Vite's dep-pre-bundle cache)
 *
 * Strictly non-destructive beyond these three paths. Refuses to
 * delete anything else even with --force. Idempotent — running
 * it twice in a row is a no-op on the second run.
 */
import { existsSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  'dist',
  '.vite',
  path.join('node_modules', '.vite'),
];

let removed = 0;
let skipped = 0;
const lines = [];

for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) {
    skipped++;
    lines.push(`  · ${rel} — not present`);
    continue;
  }
  let stat;
  try { stat = statSync(full); } catch { stat = null; }
  if (!stat) {
    skipped++;
    lines.push(`  · ${rel} — not readable, skipped`);
    continue;
  }
  // Sanity: never delete a path that's not inside ROOT.
  const resolved = path.resolve(full);
  const resolvedRoot = path.resolve(ROOT);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    skipped++;
    lines.push(`  · ${rel} — outside ROOT, refused`);
    continue;
  }
  try {
    rmSync(full, { recursive: true, force: true });
    removed++;
    lines.push(`  ✓ ${rel} removed`);
  } catch (e) {
    skipped++;
    lines.push(`  · ${rel} — remove failed (${e && e.code ? e.code : 'unknown'})`);
  }
}

console.log('[clean:build] cleaned stale build artifacts');
for (const ln of lines) console.log(ln);
console.log(`  ${removed} removed, ${skipped} skipped`);
process.exit(0);
