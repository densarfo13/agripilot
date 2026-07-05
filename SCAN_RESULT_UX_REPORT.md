# SCAN_RESULT_UX_REPORT.md — low-confidence Scan Result UX sprint (2026-07-05)

UX refinement only — no backend inference changes. Honest disposition of all 12 spec items:
what shipped, what already existed (reused, not rebuilt), and what was declined per governance.

## Shipped this sprint

**1+2. ScanGuidanceCard — ONE low-confidence surface, directly beneath the header.**
New `src/components/scan/ScanGuidanceCard.jsx`. Previously a low-confidence result could stack
THREE overlapping messages ("Photo guidance" card, the trust-gate coach card "Photo needs a
clearer view", and NeedsReviewActions "Needs Review") with two duplicate CTA rows. Now one card,
rendered immediately after the scan header (`_showGuidance = trustBlocked || needsReview`), with
the spec copy — Title: "We couldn't identify the plant clearly." Body: daylight/one-leaf/no-shadows
— and the three CTAs: **Retake Photo** (primary) / **Upload Another Photo** / **Save for Review**
(reusing the existing i18n keys). The coach card and NeedsReviewActions renders were removed
(NeedsReviewActions.jsx is now unreferenced).

**3. Treatment + Region hidden on low confidence.**
`TreatmentSection` and `RegionSection` render only when NOT in guidance mode; the guidance card
shows "Once we can clearly identify the plant, we'll provide treatment recommendations." (Server
already curates treatment to confident matches — this adds the client-side belt.)

**5. Hierarchy.** Result header → Guidance (with Retake CTAs) → identification/top-matches →
health → treatment/region (confident only) → actions. The next action is now the first thing a
farmer sees on an unclear scan. (Voice slot intentionally absent — see item 4.)

**6. Confidence badge.** Proper pill beside the "Top matches" title (was a plain text suffix).
Bands from the REAL `confidencePct` (≥70 HIGH / ≥40 MEDIUM / else LOW), colored, `aria-label`ed;
the server's own `confidenceLabel` wins as text when present. Reuses existing
`scan.confidence.high/medium/low` keys.

**7. Photo quality + why.** Renders PhotoQualityEngine's existing measured `qualityLabel`
(Excellent/Good/Fair/Poor — engine never invents sub-scores) plus its `whatWentWrong` reasons
inside the guidance card. Hidden when the engine has no opinion — never fabricated.

**8. Camera tips.** Five tips in the guidance card (daylight / fill frame / one leaf / avoid blur
/ no fingers), i18n'd.

**11. Accessibility.** All guidance CTAs ≥48px touch targets, full-width, `aria-label`s, high-
contrast ink on light amber; badge carries `aria-label`.

**i18n:** 14 new `scan.guidance.*` keys translated across all 6 locale columns (en/fr/sw/ha/tw/hi);
parity gates green.

## Already existed — reused, not rebuilt (Build Once)
- **9. Compare photo:** `PhotoComparisonCard` (before/after pair per scan) exists in the outcomes
  flow. Not duplicated inline on the result screen this sprint.
- **10. Follow-up reminder:** `followUpTaskFor` already merges a "scan again" follow-up task into
  suggested tasks, and the envelope carries `followUpPlan`/`followUpDate` with existing
  `scan.followUp.*` strings. No second reminder system built.

## Declined per governance
- **4. "Ask Jarvis" voice panel:** voice is PARKED (founder decision 2026-07-05) and the voice
  spec's hard rule forbids mounting on /scan. The spec's own clause resolves it: "If disabled
  entirely: hide panel" — it is disabled entirely, so no panel ships. A dead mic button would be
  a broken promise on the app's most trust-critical screen. Design lives in `VOICE_PLATFORM.md`
  (Track B).

## Verification
- Render harness (`repro-scan-render-crash.mjs --strict`, runs inside build:safe): success /
  lowConf / sparse all render; NEW assertions — guidance card PRESENT on lowConf, ABSENT on a
  confident result, and the removed duplicate coach card can never silently return. The success
  envelope was aligned to the real production shape (`topCandidates` present — the trust gate
  correctly blocks when it's empty at any confidence).
- `npm run typecheck`: no such script in this repo (stated honestly). Lint/hooks/no-undef/i18n
  enforced via build:safe; `npm run build` is build:safe's final step.
- build:safe: see commit (411 gates).
- On-device pass of the new low-confidence flow rides the W6 acceptance matrix.
