# FARMER_COMPLETION_SYSTEM_REPORT.md

**Sprint #212 — Farmer Completion System + Last-10% Pilot Fix.**
Date: 2026-06-19. Off the frozen list (no satellite / AI / marketplace
/ yield). All work is composition or i18n registration.

---

## 1. Files created
- `src/runtime/farmerCompletion/FarmerCompletionContracts.ts`
- `src/runtime/farmerCompletion/FarmerCompletionEngine.ts`
- `src/runtime/farmerCompletion/FarmerNextStepEngine.ts`
- `src/runtime/tasks/TaskDeduper.ts`
- `src/runtime/notifications/NotificationDeduper.ts`
- `src/runtime/farmTimeline/FarmTimelineContracts.ts`
- `src/runtime/farmTimeline/FarmTimelineEngine.ts`
- `src/runtime/farmBrain/FarmBrainExplanation.ts`
- `scripts/check-farmer-completion.mjs`, `check-empty-state-guidance.mjs`,
  `check-task-dedup.mjs`, `check-notification-dedup.mjs`,
  `check-language-leaks-final.mjs`
- this report

## 2. Files modified
- `src/i18n/columns/*` — 39 keys registered ×6 locales
- `src/runtime/farmBrain/FarmTimeline.ts` — +2 journey kinds
- `src/components/farmBrain/FarmBrainBelowFold.jsx` — Farm Setup + FarmBrain confidence cards
- `src/pages/farmer/FarmerTodayPage.jsx` — task dedupe at render
- `src/components/NotificationCenter.jsx` — notification dedupe at render
- `src/pages/FarmerProgressPage.jsx` — engine-backed farm journey
- `src/runtime/analytics/PilotEventContracts.ts` — +7 events
- `src/App.jsx` — 5 boot installs
- `package.json` — 5 gates wired into build:safe

## 3. Farmer completion summary
8-step tracker (`FarmerCompletionEngine`): farmCreated · locationAdded ·
cropSelected · plantingDateAdded · firstScanCompleted ·
firstTaskCompleted · firstOutcomeRecorded ·
firstHarvestOrSellDraftCreated → `{completedSteps, totalSteps,
percentComplete, nextBestStep, nextBestStepReason, primaryCTA}`. Each
step "done" only when its real datum exists; `computeNextStep` returns
the first incomplete step + reason + CTA. Rendered on Home as the
"Farm Setup Progress" card (hidden once 100%).

## 4. Empty-state fixes
The **root cause** of the screenshots: 13 farmer keys (`activity.empty.*`,
`simple.tasks.*`, `myFarm.status.*`) were referenced via `tSafe` but
**never registered in `T-en.js`** — so `tSafe` fell back to the English
literal in EVERY locale (incl. Twi), permanently, because the key
didn't exist for a translator to fill. All 13 (+ related) are now
registered → translatable. The Home "Not enough data yet" block is
replaced by the guided Farm Setup card; the Activity timeline carries
a "Your farm story starts here." + Run-first-scan CTA.

## 5. Task dedupe summary
`TaskDeduper.dedupeTasks` keys on (taskType, farmId, cropId, dueDate,
sourceEngine). Highest priority wins; user notes preserved (merged).
Wired at the FarmerTodayPage aggregation point → no duplicate "Care
for your plants" / "Add planting date". `__taskDedupHealth()`.

## 6. Notification dedupe summary
`NotificationDeduper.dedupeNotifications` keys on (titleKey, type,
relatedEntityId, createdDay). Newest unread kept; collisions collapse
into `duplicateCount` ("Today on your farm" ×4 → one row, count 4).
Wired in NotificationCenter render. `__notificationDedupHealth()`.

## 7. Language leak fixes
**All 12 screenshot strings were already `tSafe`-wrapped — zero
hardcoded code leaks.** The real fix was registering the 13 escaped
keys (above). `__farrowayLanguageLeaks()` returns `[]` code leaks.
Remaining English-on-Twi is the **translator gap** (Twi 97.1%, #211)
— English-fallback safe, queued for the translator; NOT fabricated.

## 8. Farm timeline summary
`FarmTimelineEngine` (wraps #209 FarmTimeline) tracks all 10 journey
kinds (incl. harvest_draft_created, sell_listing_created). Read-only;
empty → guided story + scan CTA. Rendered on the Activity page.
`__farmTimelineHealth()`.

## 9. FarmBrain explanation summary
`FarmBrainExplanation` composes the completion state into
`{confidence, why[], missing[], nextActionKey}` — confidence is the
completion %, why = data we have, missing = data we lack (each missing
item is the next action). NO score without explanation.
`__farmBrainExplanationHealth()`. Rendered as the FarmBrain Confidence
card on Home.

## 10. Health check outputs (structural)
```
__farmerCompletionHealth()      → farmerCompletionReady:true, totalSteps:8
__taskDedupHealth()             → taskDedupReady:true, 5 dedup keys
__notificationDedupHealth()     → notificationDedupReady:true, 4 dedup keys
__farmTimelineHealth()          → farmTimelineReady:true, trackedKinds:10
__farmBrainExplanationHealth()  → farmBrainExplanationReady:true
__farrowayLanguageLeaks()       → [] (code leaks)
```

## 11. Build results
5 new gates wired into build:safe; all dry-run PASS. Full `build:safe`
result in the commit.

## 12. Pilot readiness verdict
**The last visible blockers are addressed in code.** Duplicate tasks/
notifications now dedupe; empty states are guided; the Twi English-leak
root cause (unregistered keys) is fixed so the strings are finally
translatable. The only residual is the **translator gap** (Twi/other
locales finishing the registered keys) — human work, English-fallback
safe, and the precise worklist is in the #211 reports. Engineering:
**READY FOR PILOT.**

## KPI Impact (Founder Decision Rule)
Completion ladder + guided empty states → **Today's Action Started %**
/ activation. Dedupe removes the duplicate-task confusion the
screenshots showed → cleaner first-session. Composition only; no
north-star moves until pilot farmers act.
