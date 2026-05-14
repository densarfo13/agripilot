# Farroway Live-Device Production Smoke Checklist

**Audience**: QA operator running pre-publish smoke tests on a real
iPhone Safari + Android Chrome device.

**Goal**: Verify every critical production flow on real hardware
in under 30 minutes. Each step has a single PASS/FAIL outcome.
Capture the listed artefact for every FAIL so engineering can
diagnose without re-running the test.

**Rule**: One FAIL on any step marked **BLOCKER** blocks publish.

---

## Pre-flight

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| P1 | Fresh install — clear Safari + Chrome data for `farroway.app` | Sign-in screen appears, no stale session | Screenshot of stuck screen |
| P2 | Verify build version | DevTools console shows `[Farroway UI] Alive runtime active` + a build-version line | Console screenshot |
| P3 | Network panel clean | No 4xx or 5xx on first load (a single 401 on `/api/me` before sign-in is expected) | HAR export |

---

## A. Home hydration  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| A1 | Sign in as a test farmer who already has one farm | `/home` lands within 4s and renders the farm name in the FarmGardenProfileCard | Screenshot of Home top section |
| A2 | Confirm no false empty state | Card does NOT say "No farm added yet" while My Farm shows a farm | Side-by-side screenshot Home vs My Farm |
| A3 | Console shows `[HOME_FARM_HYDRATION]` | `{ farmsCount > 0, activeFarmId not null, resolvedActiveFarmName: <name>, source: 'useExperience.activeEntity' or 'farmContextEngine' }` | Console line copy |
| A4 | Pull-to-refresh / hard reload | Home re-renders the same farm; no flicker of empty state | Video clip |
| A5 | Switch to a SECOND farm via My Farm → return to Home | Home now shows the new farm without manual refresh | Screenshot |
| A6 | Sign out → sign in as a brand-new farmer (no farm) | Card shows "No farm added yet" — that state is correct here only | Screenshot |

**Regression checks**:
- A6 must NOT fire on accounts with farms.
- A2 is the historic bug; re-run twice to confirm reproducibility.

---

## B. Scan pipeline  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| B1 | Tap Scan tab → camera permission prompt appears (first time only) | Browser-native prompt renders within 2s | Screenshot |
| B2 | Allow camera → live preview shows within 5s | No black screen, no permanent spinner | Video clip |
| B3 | Capture a leaf photo | `[SCAN_CAPTURED]` log appears within 1s | Console line |
| B4 | Wait for analysis | Result OR rule-based fallback within 15s — NEVER stuck on "taking longer than expected" past 18s | Video clip + console log of `[SCAN_INFERENCE_RESPONSE]` |
| B5 | Result page renders | possibleIssue + confidence + recommended action all visible | Screenshot |
| B6 | Tap "Add to today's plan" | Task appears in Today's tasks immediately | Screenshot Tasks page |
| B7 | Tap "Use saved photo" instead | Gallery picker opens, can select a photo, same pipeline runs | Video clip |
| B8 | Deny camera permission (test in Settings → Safari → Camera = Deny) | Calm "Camera access is turned off for Safari" copy + "Open Safari Settings" CTA + "Use saved photo" CTA — NEVER bare DOMException name | Screenshot |
| B9 | Force a hung backend (Airplane Mode mid-upload) | Rule-based fallback fires within 15s, result page still renders | Screenshot |

**Regression checks**:
- B4 was the indefinite stall — verify 15s ceiling holds.
- B8 must show iOS-specific copy on iPhone Safari; generic on Chrome.

---

## C. Weather accuracy + units  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| C1 | US farmer signed in (country=US on farm record) | Home weather hero shows e.g. `55°F` not `13°` or `13°C` | Screenshot |
| C2 | Ghana farmer signed in | Same hero shows `28°C` | Screenshot |
| C3 | Check `[WEATHER_LOCATION]` console line | latitude/longitude/source/label populated correctly | Console copy |
| C4 | Verify temp is CURRENT not daily high | Compare to phone's weather app for the same location — within ±2°F | Side-by-side screenshot |
| C5 | Settings → Temperature unit → set to Celsius (with country=US) | Hero flips to `13°C` within 1s of returning to Home | Screenshot |
| C6 | Reset to Auto → kill app → reopen | Auto resolves to country default (F for US) — no flicker | Video clip |

**Regression checks**:
- C4 was the Maryland bug — daily-high shown as current. Always check against an external weather source.

---

## D. Tasks / Progress / Journal loop  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| D1 | Open Tasks tab | At least one current task is visible, image-based hero renders | Screenshot |
| D2 | Tap "Mark done" on the current task | CompletionCard appears within 500ms, task disappears from active list | Video clip |
| D3 | Open Progress tab | Today's completion count incremented by 1 | Screenshot |
| D4 | Open Journal tab | New "Task completed: <title>" entry at the top | Screenshot |
| D5 | Open Home | Next-best-action recommendation has updated | Screenshot |
| D6 | Airplane Mode → mark another task done → re-enable network | Task syncs within 30s of reconnection (no duplicate task in journal) | Console log of sync drain |

**Regression checks**:
- D5: Home recommendation MUST change after a task is completed (per Operational Trust spec).
- D6: queued completions never produce duplicate journal entries.

---

## E. Bottom nav + safe area  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| E1 | iPhone Safari home indicator bar | Bottom nav sits ABOVE the home indicator; no overlap | Screenshot |
| E2 | Tap each tab — Home / Tasks / Scan / Sell / Progress | Each route resolves under 2s; correct page renders | Video clip |
| E3 | Pull-to-refresh on each tab | Page rehydrates without losing nav | Video clip |
| E4 | Android Chrome — soft nav bar at bottom | Bottom nav NOT covered | Screenshot |
| E5 | PWA mode (Add to Home Screen → open) | Bottom nav visible + safe-area respected | Screenshot |

---

## F. Farm persistence  **BLOCKER**

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| F1 | Create a small farm — name, crop, size, country | Saves in < 3s, redirects to Home showing the new farm | Screenshot |
| F2 | Force-quit the app → reopen | Same farm renders on Home AND My Farm | Screenshot pair |
| F3 | Clear Safari cache only (NOT cookies / auth) | Farm still persists (backend mirror) | Screenshot |
| F4 | Sign out → sign back in | Same farm renders, same activeFarmId | Screenshot |
| F5 | Create a SECOND farm (e.g. backyard pots) | Both visible in My Farm; switcher works | Screenshot |
| F6 | Switch active farm → reload | Home reflects the switched farm | Video clip |

**Regression checks**:
- F2 was unstable in early builds — verify across iOS Safari AND Chrome.

---

## G. Gallery / image fallback

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| G1 | Pick a large iPhone HEIC photo from gallery | Compression succeeds within 10s; upload proceeds | Console log of `[SCAN_COMPRESSED]` |
| G2 | Pick a 4032×3024 JPEG | Same as G1 | Console log |
| G3 | Pick a 50×50 thumbnail | Result page shows "needs closer photo" fallback wording | Screenshot |
| G4 | Pick a non-image file (PDF) | Rejected with calm copy, no crash | Screenshot |

---

## H. Funding flow

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| H1 | Open Funding tab | Page renders within 3s; image-based hero | Screenshot |
| H2 | Empty state (no live partners yet) | Calm "We're onboarding partners — check back soon" copy, NOT a fake list | Screenshot |
| H3 | Filter by region | Filter pills don't crash on empty list | Screenshot |
| H4 | Tap any informational card | No claims of guaranteed funding | Screenshot of card text |

**Regression checks**:
- H2 must NEVER show fabricated opportunities to a real user.

---

## I. Sell / Buyer flow

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| I1 | Open Sell tab | Hero renders; if seller has a recent ready-to-list produce scan, the HarvestReadyPrompt appears | Screenshot |
| I2 | Fill out listing form (crop, qty, unit, ready date, location) | Saves locally + syncs to backend; new listing card appears | Screenshot |
| I3 | Mark listing sold | Status flips to "Sold"; no longer in active list | Screenshot |
| I4 | Buyer-side route (if accessible to test account) | Listing visible; no PII (phone, email) leaked | Screenshot |
| I5 | Edit listing | Updates persist after force-quit | Screenshot |

---

## J. Offline / reload

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| J1 | Airplane Mode → reload Home | Cached home renders within 4s; no crash | Screenshot |
| J2 | Offline → complete a task | Task queues locally; banner indicates pending sync | Screenshot |
| J3 | Re-enable network | Queued items drain automatically within 30s | Console log of drain |
| J4 | Force-quit → reopen offline | Auth still recognises the user (session cookie persists) | Screenshot |
| J5 | Hard refresh (Cmd+R / pull-to-refresh full) | Service worker serves the LATEST build, not a stale bundle | Build-version console line |

**Regression checks**:
- J5: confirm `[Farroway UI] Alive runtime active` reports the SAME version that's deployed.

---

## K. NGO / Admin (if test account exists)

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| K1 | Sign in as NGO test account | NGO dashboard renders, NOT farmer Home | Screenshot |
| K2 | Farmers list shows seeded data (post-UAT-seed) | Realistic row count, no "0 farmers" empty state | Screenshot |
| K3 | Sign in as Admin test account | Admin dashboard renders | Screenshot |
| K4 | Role guards: farmer can't navigate to /admin | Redirected to /home with no error | Video clip |

---

## L. Console + runtime hygiene

| # | Step | PASS criterion | Artefact on FAIL |
|---|---|---|---|
| L1 | DevTools console after 5 min of normal use | NO uncaught errors. Warnings OK. | Console export |
| L2 | No auth-refresh loops | `[REFRESH_START]` count < 5 per 5 minutes | Console export |
| L3 | No invalid-URL errors | `[INVALID_URL]` count = 0 | Console export |
| L4 | No 404 on any image | Network panel filtered by status:404 image: empty | HAR export |
| L5 | No analytics retry loops | No infinite POSTs to `/api/analytics` | HAR export |

---

## Final pass criteria

The build is **smoke-ready for publish** when:
- Every step marked **BLOCKER** passes on iPhone Safari AND Android Chrome
- L1–L5 all pass
- No FAIL artefact has been captured in the last full run

**The QA operator signs off by attaching this checklist with a
PASS/FAIL stamp per row and uploading any FAIL artefacts to the
team folder.**

---

## Test accounts

Recommend three pre-seeded test accounts (created by the UAT
seed module — see `src/lib/seed/uatSeed.js`):

| Role    | Email                       | Notes |
|---------|-----------------------------|-------|
| Farmer  | qa.farmer.us@farroway.app   | US small farm in Maryland (covers weather unit + Maryland coords) |
| Farmer  | qa.farmer.gh@farroway.app   | Ghana backyard garden (covers Celsius + garden mode) |
| NGO     | qa.ngo@farroway.app         | NGO viewer for K1–K2 |
| Admin   | qa.admin@farroway.app       | Admin viewer for K3 |

---

## Reporting template

```
Build version:   <FARROWAY_BUILD_VERSION>
Commit SHA:      <FARROWAY_COMMIT_SHA>
Tester:          <name>
Device:          <model, OS version>
Browser:         iPhone Safari <ver> / Android Chrome <ver>
Date:            <YYYY-MM-DD>
Network:         <WiFi / 5G / 4G>

A. Home hydration       — PASS / FAIL
B. Scan pipeline        — PASS / FAIL
C. Weather              — PASS / FAIL
D. Task loop            — PASS / FAIL
E. Bottom nav           — PASS / FAIL
F. Farm persistence     — PASS / FAIL
G. Gallery fallback     — PASS / FAIL
H. Funding              — PASS / FAIL
I. Sell                 — PASS / FAIL
J. Offline              — PASS / FAIL
K. NGO/Admin            — PASS / N/A
L. Console hygiene      — PASS / FAIL

Verdict: SMOKE-READY / NOT READY
Notes:
```
