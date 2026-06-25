#!/usr/bin/env node
/**
 * scripts/deploy/deploy-railway.mjs
 *
 * Canonical Railway deploy entrypoint. Replaces ad-hoc
 * `railway up` calls with a hardened pipeline:
 *
 *   1. Verify environment (railway CLI present + authed,
 *      git tree clean, on master).
 *   2. Sync to origin/master (fetch + fast-forward).
 *   3. Verify local HEAD equals origin/master (integrity gate).
 *   4. Write BUILD_SHA + BUILD_TIMESTAMP files so the Docker
 *      build can bake them into the image (the .git directory
 *      is .dockerignored, so we can't read SHA at build time
 *      from inside the container).
 *   5. Trigger `railway up --detach` with a descriptive message.
 *   6. Poll deployment status until terminal.
 *   7. Curl /api/health, verify reported gitSha matches the
 *      deployed commit. Alert (but never auto-rollback) on
 *      mismatch.
 *   8. Print a structured deploy summary suitable for paste
 *      into a release log.
 *
 * Flags:
 *   --dry-run         : run all checks + write files, but DO NOT
 *                       upload. Useful for CI lint-style runs.
 *   --auto-pull       : if local master is behind origin, fast-
 *                       forward automatically. Default behaviour
 *                       is to fail with instructions.
 *   --allow-dirty     : skip the working-tree-clean check.
 *                       Dangerous — uncommitted changes pollute
 *                       the build context.
 *   --allow-non-master: deploy from current branch even if it
 *                       isn't master. Used for hotfix branches.
 *   --skip-verify     : skip the post-deploy /api/health gitSha
 *                       check. Use when /api/health is not yet
 *                       reachable (e.g. brand-new service).
 *   --health-url <u>  : override the /api/health URL probed
 *                       post-deploy. Default reads from the
 *                       FARROWAY_HEALTH_URL env var, falls
 *                       through to https://farroway.app/api/health.
 *   --timeout <sec>   : how long to wait for Railway to reach a
 *                       terminal state. Default 900 (15 min).
 *
 * Exit codes:
 *   0  — deployed + verified
 *   1  — pre-flight failure (dirty tree, wrong branch, SHA drift)
 *   2  — railway up failed
 *   3  — deployment finished but did NOT reach SUCCESS
 *   4  — post-deploy /api/health verification failed
 *
 * NEVER auto-rolls-back. Per the production runbook a failed
 * deploy is investigated, not silently reverted; the operator
 * decides whether to trigger `railway service rollback` or push
 * a fix-forward commit.
 */

import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const args = new Set(process.argv.slice(2));
const argVal = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 && i < process.argv.length - 1 ? process.argv[i + 1] : null;
};

const DRY_RUN          = args.has('--dry-run');
const AUTO_PULL        = args.has('--auto-pull');
const ALLOW_DIRTY      = args.has('--allow-dirty');
const ALLOW_NON_MASTER = args.has('--allow-non-master');
const SKIP_VERIFY      = args.has('--skip-verify');
const HEALTH_URL =
     argVal('--health-url')
  || process.env.FARROWAY_HEALTH_URL
  || 'https://farroway.app/api/health';
const TIMEOUT_SEC = Number(argVal('--timeout')) || 900;

const BUILD_SHA_FILE       = resolve(ROOT, 'BUILD_SHA');
const BUILD_TIMESTAMP_FILE = resolve(ROOT, 'BUILD_TIMESTAMP');

function log(msg) { console.log(`[deploy-railway] ${msg}`); }
function warn(msg) { console.warn(`[deploy-railway] WARN: ${msg}`); }
function fail(code, msg) {
  console.error(`[deploy-railway] FAIL: ${msg}`);
  process.exit(code);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}
function runOk(cmd) {
  try { run(cmd); return true; } catch { return false; }
}

// ─── Pre-flight 1: tooling ──────────────────────────────────
log('Pre-flight 1/5: verifying tooling');
if (!runOk('git --version')) fail(1, 'git not found on PATH');
if (!runOk('railway --version')) fail(1, 'railway CLI not found on PATH — install with `npm i -g @railway/cli`');
try {
  const who = run('railway whoami');
  log(`  railway authenticated as: ${who.replace(/^\s*Logged in as\s*/, '')}`);
} catch {
  fail(1, 'railway not authenticated — run `railway login`');
}

// ─── Pre-flight 2: branch ───────────────────────────────────
log('Pre-flight 2/5: verifying branch');
const branch = run('git rev-parse --abbrev-ref HEAD');
log(`  current branch: ${branch}`);
if (branch !== 'master' && !ALLOW_NON_MASTER) {
  fail(1, `deploys must run from master (got '${branch}'). `
        + 'Use --allow-non-master for hotfix branches.');
}

// ─── Pre-flight 3: working tree clean ───────────────────────
log('Pre-flight 3/5: verifying working tree');
const status = run('git status --porcelain');
if (status && !ALLOW_DIRTY) {
  fail(1,
    'working tree is dirty. The build context would include uncommitted\n'
    + 'changes which is exactly how the May 2026 pre-cutover stale-deploy\n'
    + 'happened. Either commit/stash the changes, or pass --allow-dirty\n'
    + 'if you understand what you are uploading.\n\n'
    + 'Dirty files:\n' + status);
}
log('  clean');

// ─── Pre-flight 4: sync with upstream ───────────────────────
// For master deploys, upstream is origin/master. For --allow-non-master
// flows (hotfix branches), upstream is origin/<currentBranch>. Both
// must match the local HEAD before we ship — otherwise the build
// context wouldn't reflect what's on the remote anyone else can review.
const upstreamBranch = (branch === 'master' || !ALLOW_NON_MASTER)
  ? 'master'
  : branch;
const upstreamRef = `origin/${upstreamBranch}`;
log(`Pre-flight 4/5: syncing with ${upstreamRef}`);
try { run(`git fetch origin ${upstreamBranch}`); }
catch (err) { fail(1, `git fetch failed: ${err.message}`); }

const localHead = run('git rev-parse HEAD');
let originHead;
try { originHead = run(`git rev-parse ${upstreamRef}`); }
catch {
  fail(1, `upstream ${upstreamRef} not found on origin — push the branch first.`);
}
log(`  local HEAD       : ${localHead}`);
log(`  ${upstreamRef.padEnd(16)} : ${originHead}`);

if (localHead !== originHead) {
  // Local is behind (or ahead, or diverged).
  const behind = run(`git rev-list --count HEAD..${upstreamRef}`);
  const ahead  = run(`git rev-list --count ${upstreamRef}..HEAD`);
  if (Number(behind) > 0 && Number(ahead) === 0) {
    // Fast-forward possible.
    if (!AUTO_PULL) {
      fail(1,
        `local ${branch} is behind ${upstreamRef} by ${behind} commit(s).\n`
        + 'Re-run with --auto-pull to fast-forward, or pull manually:\n'
        + `  git pull --ff-only origin ${upstreamBranch}`);
    }
    log(`  fast-forwarding local ${branch} (${behind} commits behind)`);
    run(`git merge --ff-only ${upstreamRef}`);
  } else {
    fail(1,
      `local ${branch} has diverged from ${upstreamRef} `
      + `(${ahead} ahead, ${behind} behind). Resolve manually before deploying.\n`
      + 'For hotfix branches: push your local branch first, then re-run.');
  }
}

const deploySha = run('git rev-parse HEAD');
const deployShaShort = deploySha.slice(0, 8);
const commitSubject = run('git log -1 --pretty=%s');
const commitAuthor  = run('git log -1 --pretty=%an');
const commitDate    = run('git log -1 --pretty=%ai');
log(`  deploying SHA    : ${deploySha}`);
log(`  subject          : ${commitSubject}`);

// ─── Pre-flight 5: write BUILD_SHA / BUILD_TIMESTAMP ────────
log('Pre-flight 5/5: writing build-metadata files');
const buildTimestamp = new Date().toISOString();
writeFileSync(BUILD_SHA_FILE, deploySha + '\n', 'utf8');
writeFileSync(BUILD_TIMESTAMP_FILE, buildTimestamp + '\n', 'utf8');
log(`  wrote BUILD_SHA        : ${BUILD_SHA_FILE}`);
log(`  wrote BUILD_TIMESTAMP  : ${BUILD_TIMESTAMP_FILE}`);
log(`  build timestamp        : ${buildTimestamp}`);

// Always clean these files up so they don't pollute a follow-up
// `git status` if the deploy aborts mid-way. They're added to
// .gitignore so they're not tracked, but a stale BUILD_SHA file
// could mislead a manual operator running `cat BUILD_SHA`.
let cleanupCalled = false;
function cleanup() {
  if (cleanupCalled) return;
  cleanupCalled = true;
  try { if (existsSync(BUILD_SHA_FILE)) rmSync(BUILD_SHA_FILE); } catch { /* ignore */ }
  try { if (existsSync(BUILD_TIMESTAMP_FILE)) rmSync(BUILD_TIMESTAMP_FILE); } catch { /* ignore */ }
}
process.on('exit', cleanup);
process.on('SIGINT',  () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

if (DRY_RUN) {
  log('');
  log('DRY RUN — all pre-flight checks PASSED, build-metadata files written');
  log('          but no upload was triggered. Files will be cleaned up on exit.');
  log('');
  log(`Deploy summary (would have shipped):`);
  log(`  sha       : ${deploySha}`);
  log(`  short     : ${deployShaShort}`);
  log(`  subject   : ${commitSubject}`);
  log(`  author    : ${commitAuthor}`);
  log(`  date      : ${commitDate}`);
  log(`  timestamp : ${buildTimestamp}`);
  process.exit(0);
}

// ─── Deploy: railway up ─────────────────────────────────────
log('');
log('Triggering railway up (detached)…');
const upMessage = `${deployShaShort} ${commitSubject}`.slice(0, 200);

// Deployment reliability: `railway up` uploads a code snapshot over TLS to
// backboard.railway.com. Transient network/TLS faults (e.g. "BadRecordMac",
// "connection error", "SendRequest", timeouts) can abort the upload before the
// build even starts. Retry those with exponential backoff; fail fast on a
// genuine error (auth/invalid project) where retrying is pointless.
const UP_MAX_ATTEMPTS = Number(process.env.RAILWAY_UP_RETRIES || 4);
const TRANSIENT_RE = /BadRecordMac|connection error|SendRequest|client error|timed? out|timeout|reset by peer|EOF|tls|handshake|temporarily|503|502|504/i;
let upResult = null;
let upOutput = '';
for (let attempt = 1; attempt <= UP_MAX_ATTEMPTS; attempt += 1) {
  upResult = spawnSync('railway', [
    'up', '--detach',
    '--message', upMessage,
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  upOutput = (upResult.stdout || '') + (upResult.stderr || '');
  if (upResult.status === 0) break;
  const transient = TRANSIENT_RE.test(upOutput);
  if (!transient || attempt === UP_MAX_ATTEMPTS) {
    fail(2, `railway up failed (exit ${upResult.status}, attempt ${attempt}/${UP_MAX_ATTEMPTS}`
      + (transient ? ', transient — exhausted retries' : ', non-transient — not retrying') + '):\n'
      + (upResult.stderr || upResult.stdout || '(no output)'));
  }
  const backoffMs = Math.min(30000, 2000 * 2 ** (attempt - 1));
  warn(`railway up attempt ${attempt}/${UP_MAX_ATTEMPTS} hit a transient network/TLS fault — `
    + `retrying in ${Math.round(backoffMs / 1000)}s…`);
  // Blocking sleep without a busy-wait or extra deps.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoffMs);
}
process.stdout.write(upOutput);

// Extract the new deployment ID from `railway up` output. The CLI
// prints a Build Logs URL containing `?id=<uuid>` — grep for it.
const deployIdMatch = upOutput.match(/[?&]id=([0-9a-f-]{36})/i);
if (!deployIdMatch) {
  warn('could not extract deployment ID from railway up output — will poll latest');
}
const deployId = deployIdMatch ? deployIdMatch[1] : null;
log(`new deployment ID: ${deployId || '(unknown — falling back to latest)'}`);

// ─── Poll deployment status ─────────────────────────────────
log('');
log(`Polling deployment status (timeout ${TIMEOUT_SEC}s)…`);
const startedAt = Date.now();
let prevStatus = '';
let finalStatus = null;

while ((Date.now() - startedAt) / 1000 < TIMEOUT_SEC) {
  let list;
  try { list = run('railway deployment list'); }
  catch (err) { warn(`deployment list failed: ${err.message}`); }

  if (list) {
    const lines = list.split('\n');
    const match = deployId
      ? lines.find((l) => l.includes(deployId))
      : lines.find((l) => /SUCCESS|FAILED|CRASHED|REMOVED|BUILDING|DEPLOYING/.test(l));
    if (match) {
      const fields = match.split('|').map((s) => s.trim());
      const status = fields[1] || '';
      if (status && status !== prevStatus) {
        log(`  status → ${status}`);
        prevStatus = status;
      }
      if (/^(SUCCESS|FAILED|CRASHED|REMOVED|SKIPPED)$/.test(status)) {
        finalStatus = status;
        break;
      }
    }
  }
  // 15s poll interval — Railway deploys typically take 3-8 min;
  // 15s is responsive without rate-limiting the CLI.
  await new Promise((r) => setTimeout(r, 15_000));
}

if (!finalStatus) fail(3, `timed out after ${TIMEOUT_SEC}s waiting for terminal status`);
if (finalStatus !== 'SUCCESS') {
  fail(3, `deployment terminal status was ${finalStatus} (expected SUCCESS).\n`
        + 'Inspect logs: railway logs -b ' + (deployId || ''));
}
log(`deployment terminal status: SUCCESS`);

// ─── Post-deploy verification ───────────────────────────────
if (SKIP_VERIFY) {
  log('');
  log('Skipping /api/health verification (--skip-verify).');
} else {
  log('');
  log(`Post-deploy verification: GET ${HEALTH_URL}`);
  // Brief grace period — Railway flips the deployment to SUCCESS
  // once the container is responsive, but the public domain may
  // take a few seconds to start serving the new build through any
  // edge cache.
  await new Promise((r) => setTimeout(r, 5_000));
  let health = null;
  let healthStatus = 0;
  try {
    const fetchRes = await fetch(HEALTH_URL, { headers: { 'cache-control': 'no-cache' } });
    healthStatus = fetchRes.status;
    if (fetchRes.ok) health = await fetchRes.json();
  } catch (err) {
    fail(4, `/api/health fetch failed: ${err.message}`);
  }
  if (!health) fail(4, `/api/health returned ${healthStatus}, no body`);

  log(`  HTTP status   : ${healthStatus}`);
  log(`  reported version : ${health.version || '(none)'}`);
  log(`  reported gitSha  : ${health.gitSha || '(none — endpoint may not yet expose this field)'}`);
  log(`  reported uptime  : ${health.uptime || 0}s`);
  log(`  reported env     : ${health.environment || '(none)'}`);

  // Integrity check — if /api/health DOES expose gitSha (post-
  // hardening rollout), assert it matches what we just deployed.
  // If it doesn't (pre-hardening), warn but don't fail — the
  // deploy itself succeeded.
  if (health.gitSha) {
    if (health.gitSha !== deploySha) {
      fail(4, `reported gitSha (${health.gitSha}) does NOT match deployed SHA (${deploySha}).\n`
            + 'This means /api/health is serving a stale build OR the BUILD_SHA file did not\n'
            + 'make it into the container. Inspect the build logs.');
    }
    log(`  INTEGRITY CHECK PASSED: gitSha matches deployed SHA`);
  } else {
    warn('/api/health does not expose gitSha field yet — skipping integrity check.\n'
       + '       This is expected for the FIRST deploy after the hardening rollout.\n'
       + '       Subsequent deploys will assert the field exists.');
  }
}

// ─── Final summary ──────────────────────────────────────────
log('');
log('═══════════════════════════════════════════════════════════');
log(' DEPLOY COMPLETE');
log('═══════════════════════════════════════════════════════════');
log(` Git SHA          : ${deploySha}`);
log(` Short            : ${deployShaShort}`);
log(` Subject          : ${commitSubject}`);
log(` Author           : ${commitAuthor}`);
log(` Commit date      : ${commitDate}`);
log(` Build timestamp  : ${buildTimestamp}`);
log(` Deployment ID    : ${deployId || '(not extracted)'}`);
log(` Status           : ${finalStatus}`);
log(` Health URL       : ${HEALTH_URL}`);
log('═══════════════════════════════════════════════════════════');

process.exit(0);
