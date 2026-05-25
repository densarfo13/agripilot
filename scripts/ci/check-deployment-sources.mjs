#!/usr/bin/env node
/**
 * scripts/ci/check-deployment-sources.mjs
 *
 * CI guard — fails the build when the deployment source-of-truth
 * becomes ambiguous. Railway accepts BOTH a Dockerfile AND a
 * `[build] builder = "nixpacks"` declaration in railway.toml,
 * but it silently picks the Dockerfile and ignores the nixpacks
 * declaration. That mismatch caused the May 2026 stale-deploy
 * debugging session: an operator read railway.toml, saw nixpacks,
 * and spent hours wondering why the build was ignoring the
 * `buildCommand` documented there.
 *
 * Rule: at most ONE of these two may be active at a time:
 *   - Dockerfile at the repo root (with non-empty content)
 *   - railway.toml with [build].builder = "nixpacks"
 *
 * If both are present, this guard fails with a clear remediation
 * instruction. If neither is present, also fails (the service has
 * no documented build path).
 *
 * Pure source inspection. Exit 0 on PASS, 1 on FAIL.
 *
 * Wired into npm run build:safe so the gate runs on every PR.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(msg) {
  console.error('[check:deployment-sources] FAIL — ' + msg);
  process.exit(1);
}

const dockerfilePath = resolve(ROOT, 'Dockerfile');
const railwayTomlPath = resolve(ROOT, 'railway.toml');

// ─── Detect Dockerfile presence ─────────────────────────────
let hasDockerfile = false;
if (existsSync(dockerfilePath)) {
  const txt = readFileSync(dockerfilePath, 'utf8').trim();
  // Empty / comment-only Dockerfiles don't count as active. The
  // first non-comment, non-blank line MUST start with `FROM` for
  // a Dockerfile to actually build anything.
  const firstReal = txt.split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  if (firstReal && /^FROM\s+/i.test(firstReal)) {
    hasDockerfile = true;
  }
}

// ─── Detect nixpacks declaration in railway.toml ────────────
let hasNixpacks = false;
let hasRailwayToml = false;
if (existsSync(railwayTomlPath)) {
  hasRailwayToml = true;
  const txt = readFileSync(railwayTomlPath, 'utf8');
  // Strip line comments before matching. The nixpacks declaration
  // is the literal `builder = "nixpacks"` (case-insensitive on the
  // value, exact on the key) inside the [build] block. We don't
  // need a full TOML parser — the test is literal enough that a
  // line-by-line scan is correct + reviewable.
  let inBuildBlock = false;
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      inBuildBlock = sectionMatch[1].trim() === 'build';
      continue;
    }
    if (!inBuildBlock) continue;
    const m = line.match(/^builder\s*=\s*["']([^"']+)["']/i);
    if (m && m[1].trim().toLowerCase() === 'nixpacks') {
      hasNixpacks = true;
      break;
    }
  }
}

// ─── Rule evaluation ────────────────────────────────────────
if (hasDockerfile && hasNixpacks) {
  fail(
    'Deployment source ambiguous: BOTH Dockerfile AND railway.toml\n'
    + 'declare a nixpacks builder. Railway picks the Dockerfile and\n'
    + 'silently ignores the nixpacks declaration, but operators reading\n'
    + 'railway.toml will be confused.\n\n'
    + 'Remediation — pick ONE:\n'
    + '  (A) Keep the Dockerfile, remove the nixpacks builder line from\n'
    + '      railway.toml [build] block. Leave [build] empty or omit it.\n'
    + '  (B) Delete the Dockerfile, keep nixpacks. Then railway.toml\n'
    + '      [build].builder = "nixpacks" actually takes effect.\n\n'
    + 'See docs/ops/DEPLOYMENT_RUNBOOK.md §1 for the canonical choice.',
  );
}

if (!hasDockerfile && !hasNixpacks) {
  fail(
    'No documented build path: neither a Dockerfile (root) nor a\n'
    + 'railway.toml [build].builder declaration is present. Railway\n'
    + 'might fall back to nixpacks auto-detection but the deploy is\n'
    + 'not reproducible — add either a Dockerfile or a railway.toml\n'
    + '[build] section.',
  );
}

const chosen = hasDockerfile ? 'Dockerfile' : 'railway.toml/nixpacks';
console.log(
  '[check:deployment-sources] PASS — build source: '
  + chosen
  + (hasRailwayToml ? ' (railway.toml present)' : ' (no railway.toml)'),
);
