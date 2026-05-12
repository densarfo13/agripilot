#!/usr/bin/env node
/**
 * clean-dist.mjs — cross-platform dist + Vite cache wipe.
 *
 * Used by:
 *   npm run clean        — wipes dist/ + node_modules/.vite
 *   npm run build:clean  — clean + build (post-deploy diagnosis)
 *
 * Why not rimraf? Adding rimraf would touch package.json deps
 * (which the project has intentionally been keeping stable
 * across the deployment-reflection audit). Node 16+ ships
 * `fs.rmSync({recursive:true,force:true})` which does the same
 * thing without a new dependency.
 *
 * The script never throws on missing paths (force: true), so a
 * fresh repo with no dist/ yet still runs the script clean.
 */

import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGETS = [
  'dist',
  'node_modules/.vite',
];

for (const rel of TARGETS) {
  const abs = resolve(ROOT, rel);
  try {
    rmSync(abs, { recursive: true, force: true });
    // eslint-disable-next-line no-console
    console.log(`[clean] removed ${rel}`);
  } catch (err) {
    // force: true should swallow ENOENT but log anything weirder.
    // eslint-disable-next-line no-console
    console.warn(`[clean] could not remove ${rel}:`, err.message);
  }
}
