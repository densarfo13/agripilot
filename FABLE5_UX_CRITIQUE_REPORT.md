# FABLE5_UX_CRITIQUE_REPORT.md

**Sprint #198 — product-excellence critic pass.**
Date: 2026-06-15
Rubric: every farmer-facing screen must answer — what's happening ·
what to do next · why · how urgent · what happens next. Reject if:
no primary action, >2 competing CTAs, long paragraphs, AI jargon,
no reason, no follow-up path.

## Execution-policy scope ruling (read first)

The spec's §1 council runtime (4 files personifying models as a
"product quality council") and §3-§6 quality globals were **declined
under the frozen-work list**: they are new intelligence-layer
ceremony + duplicate admin systems. The contracts they would attest
are ALREADY gate-locked: `check-digital-agronomist` (Home hero,
single Start, reason+confidence), `check-universal-scan` (scan
result contract incl. never `Plant: —`), `check-scan-v3` (outcome
statuses + follow-up offsets). A runtime that re-states a gate adds
bundle weight, not quality. The critic PASS itself, the language
GATE, and the FIXES below are the policy-compatible core.

---

## Findings (ranked)

### CRITICAL — Outcome loop's last mile missing → **FIXED this sprint**

The engine side of "Did this help?" shipped long ago (followUpEngine
statuses improved/same/worse #168, outcome storage, follow-up API) —
but **no farmer-facing UI ever asked the question**. Worse, the
harvest path hard-coded `'improved'` as a default guess
(AllTasksPage knowledge-graph edge). Outcome Capture % — north-star
KPI #4 — was structurally stuck at zero.

**Fix shipped:** `src/components/tasks/OutcomePrompt.jsx` renders
under the completion celebration: *Did this help?* → 👍 Better /
➖ Same / 👎 Worse. Three ≥56px buttons, one question, no
paragraphs (low-literacy rules §7). On pick: fires the
`outcome_recorded` pilot event (closing a #189 unwired call site),
records the knowledge-graph outcome edge with the farmer's REAL
answer, logs the structured NGO event, then thanks the farmer.
5 i18n keys added + parity-stubbed ×6 locales.

### HIGH — Farmer-facing "AI" leaks (2) → **FIXED this sprint**

The new gate caught what the manual audit missed:
- `LiveCameraScanner.jsx:984` — camera guide tip rendered **"AI
  ready"** → now "Ready to scan".
- `ScanFallback.jsx:104` — fallback card title **"AI check
  unavailable"** → now "Smart check unavailable".

**Lock:** `scripts/check-farmer-facing-ai-language.mjs` (NEW, wired
into build:safe) scans 717 grower-facing files for \bAI\b, LLM,
machine learning, neural, algorithm, and provider names (Plant.id /
PlantNet / Insect.id / SoilGrids / Cloudinary / Sentinel) inside
string literals. Admin/internal surfaces exempt. Currently PASS.

### MEDIUM — "87% confidence" → "87% sure" → **FIXED this sprint**

The scan-result identification pill read "87% confidence" — accurate
but jargon-tinged for low-literacy users. Per the invisible-
intelligence rule ("how sure we are"), the rendered label is now
**"87% sure"** (`scan.intel.plant.confidence` fallback; the key has
no column override so the fallback is the live text).

### MEDIUM — My Grow category rows lack explicit affordance → deferred

`MyPlants.jsx` category tiles navigate on tap but carry no visible
CTA label. Real but minor; queue for a pilot-feedback-driven pass.

### CORRECTED — "Scan result missing primary CTA" (auditor error)

The first-pass audit flagged the scan result as lacking a primary
action. **False**: the gate-locked Permanent Action Row (Create
task · Scan again · Save for review) + the "Do this next" line
render at `IntelligentScanResult.jsx:740-768`; the auditor read
only the file's top half. No change needed; recorded so the wrong
finding doesn't resurface.

### CLEAN

- **Home** — deck hero answers all 5 questions; Start + Scan only.
- **Tasks** — current task owns Done/Skip; secondary cards are
  compact rows without CTA sprawl (the spec's §5 worry doesn't
  apply — already correct).
- **My Farm** — snapshot-first, 5-question compliant.
- **Notifications** — quiet, template-resolved, mark-all-read.
- **Weekly Review** — honest counts + "Next focus".
- **Simple Mode** — hard-split renderers; short words, one action,
  big buttons; gate-enforced copy length (#129/#130 gates).

### Mythos recommendation-rewrite (§8) — deferred with reason

Current engine output is already action-first via the 130+ entry
localized task-title map ("Check soil moisture today", not "Monitor
crop condition"). A wholesale rewrite pre-pilot would churn 6-locale
translations with zero behavioral data on which phrasings farmers
actually skip. Revisit after Phase-1 farmers generate task-skip
patterns — then rewrite the WORST performers, measured.

---

## Verdict

**Product excellence: the council's job was already done by the
gates.** This pass closed the three real gaps it found — the
outcome loop's missing last mile (the only structural KPI blocker
in the app), two AI-wording leaks, and one jargon label — and
locked farmer-facing language behind a permanent gate. 8 surfaces
audited: 6 clean, 1 fixed-critical, 1 minor deferred.
