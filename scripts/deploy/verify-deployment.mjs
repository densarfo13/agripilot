#!/usr/bin/env node
/**
 * scripts/deploy/verify-deployment.mjs
 *
 * Standalone post-deploy verifier. Hits /api/health and asserts:
 *   - HTTP 200
 *   - body.status === 'ok'
 *   - body.db === 'ok'
 *   - body.gitSha (if expected; compared to origin/master tip or --expect-sha)
 *   - body.environment matches --expect-env (default 'production')
 *
 * Useful for:
 *   - Cron / external uptime checks (cheap, ~1 HTTP call)
 *   - Post-deploy spot-check from a fresh shell after the canonical
 *     deploy-railway.mjs has finished
 *   - PR-CI smoke run against a preview environment
 *
 * Flags:
 *   --url <u>           override health URL
 *                       (default: FARROWAY_HEALTH_URL env or
 *                        https://farroway.app/api/health)
 *   --expect-sha <sha>  assert reported gitSha equals this. Default:
 *                       resolve via `git rev-parse origin/master`
 *                       (requires this to be a git checkout). Pass
 *                       --no-sha-check to skip.
 *   --no-sha-check      skip the SHA assertion entirely
 *   --expect-env <e>    assert reported environment equals this
 *                       (default 'production')
 *   --json              emit JSON instead of human-readable text
 *
 * Exit codes:
 *   0 — every assertion passed
 *   1 — fetch failed / non-200
 *   2 — status/db not healthy
 *   3 — SHA mismatch
 *   4 — environment mismatch
 */

import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && i < args.length - 1 ? args[i + 1] : null;
};
const has = (flag) => args.includes(flag);

const URL =
     argVal('--url')
  || process.env.FARROWAY_HEALTH_URL
  || 'https://farroway.app/api/health';
const NO_SHA_CHECK = has('--no-sha-check');
const EXPECT_ENV   = argVal('--expect-env') || 'production';
const JSON_OUT     = has('--json');

let expectSha = argVal('--expect-sha');
if (!expectSha && !NO_SHA_CHECK) {
  try {
    expectSha = execSync('git rev-parse origin/master', { encoding: 'utf8' }).trim();
  } catch {
    if (!JSON_OUT) {
      console.warn('[verify-deployment] WARN: could not resolve origin/master; '
        + 'pass --expect-sha <sha> or --no-sha-check to silence.');
    }
    expectSha = null;
  }
}

function out(obj, exitCode = 0) {
  if (JSON_OUT) {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    for (const [k, v] of Object.entries(obj)) {
      console.log(`  ${k.padEnd(16)} : ${v}`);
    }
  }
  process.exit(exitCode);
}

let body, httpStatus;
try {
  const res = await fetch(URL, { headers: { 'cache-control': 'no-cache' } });
  httpStatus = res.status;
  body = await res.json();
} catch (err) {
  out({ url: URL, error: err.message }, 1);
}

if (httpStatus !== 200) {
  out({ url: URL, httpStatus, body }, 1);
}

const checks = {
  url:           URL,
  httpStatus,
  status:        body.status,
  db:            body.db,
  uptime:        body.uptime,
  version:       body.version,
  gitSha:        body.gitSha || null,
  deploymentId:  body.deploymentId || null,
  deployedAt:    body.deployedAt || null,
  environment:   body.environment || null,
  releaseVersion: body.releaseVersion || null,
};

let exit = 0;
const failures = [];

if (body.status !== 'ok' || body.db !== 'ok') {
  failures.push('status/db not healthy');
  exit = 2;
}

if (!NO_SHA_CHECK && expectSha) {
  if (!body.gitSha) {
    failures.push('reported gitSha is missing (server pre-hardening?)');
    exit = exit || 3;
  } else if (body.gitSha !== expectSha) {
    failures.push(`SHA mismatch: expected ${expectSha}, got ${body.gitSha}`);
    exit = exit || 3;
  }
}

if (body.environment !== EXPECT_ENV) {
  failures.push(`environment mismatch: expected ${EXPECT_ENV}, got ${body.environment}`);
  exit = exit || 4;
}

checks.expectSha = expectSha || '(skipped)';
checks.expectEnv = EXPECT_ENV;
checks.failures  = failures;
checks.verdict   = exit === 0 ? 'PASS' : 'FAIL';

out(checks, exit);
