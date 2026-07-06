# RELEASE_GUARD — Institutional Git & Deploy Workflow

This document defines how code moves from a working tree to production for
agripilot/Farroway. It exists to fix a **workflow** defect, not a code defect.

## Why this exists (the incident)

A background automation (`AgriPilot Deploy <agripilot@deploy.local>`) was
committing **every modified file** to whatever branch was checked out and
pushing it — regardless of feature ownership. This bundled unrelated work into
single commits (e.g. an isolated NGO org-scope fix `8b865385` was buried under
a commit that also carried Jarvis, Prisma, auth and infra changes). Isolated,
reviewable history became impossible.

The remedy is a set of **guardrails + a disciplined commit workflow**:

| Concern | Control | File |
| --- | --- | --- |
| Path ownership model | classification engine | `scripts/ci/pathOwnership.mjs` |
| Reject mixed-scope commits | validator | `scripts/ci/validate-commit-scope.mjs` |
| Local enforcement | pre-commit hook | `.githooks/pre-commit` |
| Disciplined committing | preview→validate→commit→verify→push | `scripts/git/safe-commit.mjs` |
| Hook activation | installer | `scripts/git/install-hooks.mjs` |
| CI enforcement | PR workflows | `.github/workflows/commit-hygiene.yml`, `release-gate.yml` |

---

## TL;DR — the daily workflow

```sh
# once per clone:
node scripts/git/install-hooks.mjs

# feature work (NEVER commit straight to master):
git switch -c fix/<area>-<slug>

# commit ONE feature's files, with full preview/validate/verify:
node scripts/git/safe-commit.mjs -m "fix(ngo): enforce org scoping" \
  server/routes/ngoDashboard.js server/src/__tests__/ngoDashboardOrgScope.test.js --push

# then open a PR — CI required checks must pass before merge to master.
```

---

## 1. Path ownership model

Every changed path is classified into exactly **one** ownership group
(`scripts/ci/pathOwnership.mjs`, ordered, first-match-wins):

**Feature groups** (a commit may touch **at most one**):
`scan` · `ngo-dashboard` · `admin` · `analytics` · `jarvis` · `farmer-app`

**Cross-cutting groups** (may accompany a single feature group):
`prisma` · `infrastructure` · `ui-theme`

**Neutral** (reported, never blocks): `docs` · `shared` (uncategorised catch-all)

A commit is **rejected** when it:
- spans more than one **feature** group (`MIXED_FEATURE_SCOPE`), or
- carries a generated artifact without its source group (`UNEXPECTED_GENERATED`), or
- (strict mode) touches an **unowned** (`shared`) file (`UNOWNED_FILES`).

Extend the model by adding rules to `GROUPS` in `pathOwnership.mjs`. Shrinking
the `shared` catch-all over time is the goal — then flip the advisory
`ownership-report` CI job to a required check.

Inspect any commit / range / staging area:

```sh
node scripts/ci/validate-commit-scope.mjs --staged
node scripts/ci/validate-commit-scope.mjs --commit <sha>
node scripts/ci/validate-commit-scope.mjs --range origin/master..HEAD
```

---

## 2. Committing: preview → validate → commit → verify → push

`scripts/git/safe-commit.mjs` **replaces blanket `git add -A && git commit`**.

```sh
node scripts/git/safe-commit.mjs -m "<message>" [file ...] [--push] [--override "<reason>"]
```

1. **PREVIEW** — stages only the files you name (never `-A`); prints the diff stat + ownership classification.
2. **VALIDATE** — runs the scope validator; aborts on any violation.
3. **COMMIT** — creates the commit (adds a `Scope-Override` trailer if `--override` was given).
4. **VERIFY** — re-validates the new commit and prints its SHA + file list.
5. **PUSH** — only with `--push`.

---

## 3. Local enforcement (pre-commit hook)

`.githooks/pre-commit` (activate with `node scripts/git/install-hooks.mjs`, which
sets `core.hooksPath=.githooks`) blocks, in order:

1. **Direct commits to `master`/`main`** — PR-only. Override (maintainers): `ALLOW_COMMIT_TO_MASTER=1 git commit …`.
2. **Empty staging** — forces you to stage a specific feature's files.
3. **Partial staging** — a file with both staged *and* unstaged changes (commit exactly what you reviewed).
4. **Mixed scope / bad artifacts** — via `validate-commit-scope.mjs --staged`.

One-off bypass: `git commit --no-verify` (the PR CI still enforces everything).

---

## 4. CI enforcement (required checks)

| Workflow / job | Enforces |
| --- | --- |
| `commit-hygiene` → **No mixed-feature commits** | every commit in the PR is single-scope |
| `commit-hygiene` → **No runtime schema drift** | `check-prisma-fields.mjs` (no `where` on a non-existent field) |
| `commit-hygiene` → **Unowned files (advisory)** | annotates uncategorised files (non-blocking) |
| `production-safety` → **guards / tests / hooks-guard** | Prisma safety, curated tests, React-hooks rules |
| `release-gate` → **build:safe** | full clean build + all 400+ release gates |
| `release-gate` → **security** | secret scan + security unit checks |

---

## 5. Branch protection (`master` / `main`)

`master` must be **PR-only** so nothing — including the auto-commit bot — can
push to it directly. Needs `gh` (`winget install GitHub.CLI` then `gh auth login`)
or the GitHub UI.

**Phase 1 — apply now** (solo-safe: a PR is required, but you can self-merge):

```sh
cat > branch-protection.json <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["guards", "tests", "hooks-guard"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": false, "require_code_owner_reviews": false },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": true
}
JSON
gh api --method PUT -H "Accept: application/vnd.github+json" \
  repos/densarfo13/agripilot/branches/master/protection --input branch-protection.json
```

- `enforce_admins: true` + a required PR ⇒ **no direct pushes to `master`**, even
  under admin credentials — this is what stops the bot.
- `required_approving_review_count: 0` ⇒ you can merge your own PRs (raise to `1`
  once a second reviewer exists).
- Only checks already on `master` are required, so in-flight PRs are not blocked.

**Phase 2 — after the `ci/git-discipline` PR merges** (its workflows then live on
`master`), tighten:

```
"contexts": ["guards","tests","hooks-guard",
             "No mixed-feature commits","No runtime schema drift",
             "build:safe (full gate + production build)","Security scan (secrets + unit)"]
"strict": true
```

**GitHub UI equivalent** (Settings → Branches → Add rule, pattern `master`):
✔ Require a pull request before merging (0 approvals) · ✔ Require status checks
(strict off; select `guards`, `tests`, `hooks-guard`) · ✔ Do not allow bypassing
(include administrators) · ✔ Block force pushes · ✔ Block deletions.

---

## 6. Retiring the blanket auto-commit bot

The `AgriPilot Deploy` committer is **external** to this repo (it is not a git
hook, not husky, not `build:safe`). Investigation (2026-07-06) found: **no**
scheduled task, **no** running `node` watcher, and **no** VS Code/Cursor
auto-commit extension — but the repo's local git identity is set to
`AgriPilot Deploy <agripilot@deploy.local>` (`git config user.name`), so any
process running `git commit` here commits under that name. Prime suspects:
an editor "commit on save" extension (GitDoc-style), a file-watcher, or an ad-hoc
loop. Disable it at its source:

```sh
# Windows — find & disable a scheduled task:
schtasks /query /fo LIST /v | grep -i -E "agripilot|deploy|commit"
schtasks /change /tn "<TaskName>" /disable

# or a running node watcher:
wmic process where "name='node.exe'" get processid,commandline | grep -i -E "commit|deploy|watch|agripilot"
# then stop it (Task Manager, or: taskkill /PID <pid> /F)
```

Until it is disabled, `master` branch protection (§5) still neutralises its
damage: it can no longer push to `master`, and any feature-branch commit it
makes is caught by the pre-commit hook / CI. Replace its behaviour with
`scripts/git/safe-commit.mjs`.

---

## 7. Deploy runbook (Railway)

Deploys go through the hardened pipeline `scripts/deploy/deploy-railway.mjs`
(`npm run deploy:railway`). Pre-flight requires: **on `master`**, **clean tree**,
**local HEAD == origin/master**. It writes `BUILD_SHA`/`BUILD_TIMESTAMP`, runs
`railway up --detach`, polls to a terminal state, and verifies `/api/health`
reports the deployed `gitSha`. It **never** auto-rolls-back.

```sh
git switch master && git pull --ff-only
npm run deploy:railway            # add --dry-run to rehearse
```

**Known blocker (2026-07-06):** `railway up` fails from some machines with a
Windows SChannel TLS error `CRYPT_E_NO_REVOCATION_CHECK` — the machine cannot
reach certificate-revocation (OCSP/CRL) servers for `backboard.railway.com`.
This is a network/TLS condition, not the code. Resolve the network path
(VPN/proxy/firewall/AV TLS-inspection) — verify with
`curl -I https://backboard.railway.com` — then re-run. Alternatively, if the
Railway project is GitHub-connected, a push to `origin/master` auto-deploys
server-side without a local upload.

---

## 8. Escape hatches (all audited)

| Situation | Escape |
| --- | --- |
| Deliberate cross-scope commit | `Scope-Override: <reason>` trailer, or `safe-commit … --override "<reason>"` |
| Emergency direct commit to master | `ALLOW_COMMIT_TO_MASTER=1 git commit …` (CI still gates the eventual PR) |
| Skip local hook once | `git commit --no-verify` (CI still enforces on the PR) |
| Rehearse a deploy | `npm run deploy:railway -- --dry-run` |

---

## 9. Reproducible builds

- `build:safe` runs a **clean** build (`npm run clean` then a fresh Vite build)
  before the gates — no stale `dist/`.
- The deploy bakes `BUILD_SHA` + `BUILD_TIMESTAMP` into the image; `/api/health`
  echoes `gitSha`, and the deploy script asserts it matches the deployed commit.
- Generated artifacts (`src/generated/**`) are gate-verified in sync with their
  source (`check-prisma-fields.mjs`) and may only be committed alongside their
  owning group (`UNEXPECTED_GENERATED`).
```
