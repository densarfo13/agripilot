# Farroway — User Feedback Fix Loop

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY**

Lightweight feedback-driven improvement system per the final
feedback-loop spec. No app redesign, no new major features —
just capture, group, and surface.

---

## 1. Files added

```
src/analytics/userFeedbackStore.js                 (storage + requestUserFeedback helper)
src/analytics/feedbackClassifier.js                (rule-based bucket + severity + suggested fix)
src/analytics/feedbackPriority.js                  (rank by frequency × severity × launch impact)
src/components/feedback/UserFeedbackPrompt.jsx     (bottom card with 5 options + Other)
src/components/feedback/UserFeedbackPromptHost.jsx (global event listener + session rate-limit)
src/components/admin/FeedbackDashboard.jsx         (admin rollup at /admin/feedback)
src/utils/printFeedbackSummary.js                  (dev console helper)
src/docs/FEEDBACK_LOOP.md                          (this file)
```

## 2. Files modified

```
src/App.jsx                                          (admin/feedback route)
src/main.jsx                                         (auto-attach dev helper in DEV)
src/layouts/ProtectedLayout.jsx                      (mount UserFeedbackPromptHost)
src/i18n/translations.js                             (10 new keys × 6 languages)
src/components/scan/ScanResultCard.jsx               (requestUserFeedback('scan'))
src/components/home/HomeTaskEnhancer.jsx             (requestUserFeedback('home_task'))
src/components/funding/ApplicationPreviewModal.jsx   (requestUserFeedback('funding'))
src/pages/Sell.jsx                                   (requestUserFeedback('sell'))
src/pages/AdaptiveFarmSetup.jsx                      (requestUserFeedback('onboarding'))
scripts/ci/check-mobile-readiness.mjs                (+6 assertions → 35 total)
scripts/ci/check-launch-telemetry.mjs                (+3 events → 15 total)
```

No backend changes. No new feature flags.

---

## 3. Architecture

```
                    ┌───────────────────────┐
   meaningful       │ requestUserFeedback() │
   action complete  │   fire-and-forget     │
   (5 surfaces)  ──>│   farroway:request_feedback event
                    └───────────┬───────────┘
                                │
                                v
              ┌──────────────────────────────────┐
              │  UserFeedbackPromptHost (global) │
              │  • once-per-session              │
              │  • skips setup paths             │
              │  • 800ms delay (post-toast)      │
              └────────────┬─────────────────────┘
                           │
                           v
              ┌──────────────────────────────┐
              │  UserFeedbackPrompt          │
              │  • 5 options + Other         │
              │  • bottom card, no modal     │
              │  • one-tap submit            │
              └────────────┬─────────────────┘
                           │
                  saveFeedback({ screen, type, text })
                           │
                           v
                  farroway_user_feedback (localStorage)
                           │
                           v
            ┌─────────────────────────────────────┐
            │ feedbackClassifier  → bucket+fix    │
            │ feedbackPriority    → top issue     │
            │ FeedbackDashboard   → admin view    │
            │ printFeedbackSummary → dev console  │
            └─────────────────────────────────────┘
```

---

## 4. Spec § coverage

### §1 Quick feedback capture — SHIPPED
- `UserFeedbackPrompt.jsx` renders 5 options + "Other"
- "Other" reveals 400-char textarea + Send button
- Never blocks user flow — bottom card, no backdrop, no modal

### §2 Local storage first — SHIPPED
- Key: `farroway_user_feedback`
- Schema: `{ id, userId, role, experience, screen, feedbackType, feedbackText, timestamp }`
- Capped at 200 records per device
- Privacy-respecting — no phone, name, email persisted
- Backend sync hook left open (the existing analytics queue picks up `feedback_submitted` events)

### §3 Issue grouping — SHIPPED
- `feedbackClassifier.js` maps each `feedbackType` → `{ bucket, severity, suggestedFix }`
- 6 buckets: unclear_priority, scan_visibility, task_overload, unclear_result, low_value, manual_review
- `classifyAll(rows)` aggregates with severity weighting

### §4 Admin dashboard — SHIPPED at `/admin/feedback`
- Total reports, top bucket, today's count, recommended next fix
- Counts per screen + per role
- Last 10 free-form comments
- No charts library — pure inline-style cards
- `feedback_top_issue_viewed` analytics fired once per mount

### §5 Tracking events — SHIPPED
- `feedback_prompt_shown`     (host on render)
- `feedback_submitted`        (store on save)
- `feedback_top_issue_viewed` (admin dashboard on mount)
- `feedback_prompt_dismissed` (close button)

### §6 Fix priority — SHIPPED
- `feedbackPriority.computeFeedbackPriority({ rows? })` returns
  `{ topIssue, reason, recommendedNextFix, ranking, totalRows }`
- Score = frequency + severityWeight (3/2/1) + launchImpact (spec order 6..1)
- Tie-break: spec order, then frequency desc — deterministic

### §7 Dev console helper — SHIPPED
- `src/utils/printFeedbackSummary.js`
- Auto-attaches `window.__farrowayPrintFeedback` in DEV builds
- Imports tree-shake out of production via `import.meta.env.DEV`

### §8 Don't spam users — SHIPPED
- `wasPromptShownThisSession()` flag in sessionStorage
- Host skips request when on a setup path (15 prefixes blocklisted)
- Never shown on first app open — only after a request event
- 800ms delay so a success toast can clear first
- Bottom card, NEVER a modal

---

## 5. CI lock-in

```
guard:i18n           ✓  100% across 6 launch languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
guard:mobile         ✓  35/35 (6 new this commit)
guard:telemetry      ✓  15/15 (3 new this commit)
guard:ios-quirks     ✓  3/3 categories within baseline
launch-gate:final    ✓  all of the above
build                ✓  → 1.0.2-1b87e170
```

A regression that drops any of the wires (helper export, host
mount, admin route, 5 trigger sites, telemetry events) fails CI.

---

## 6. Acceptance criteria — all met

| Criterion | Status |
|---|---|
| Feedback can be submitted in one tap | ✓ — 5 options each commit immediately |
| Feedback is stored locally | ✓ — `farroway_user_feedback` localStorage |
| Feedback is grouped into issue buckets | ✓ — `feedbackClassifier` |
| Admin can see top issue | ✓ — `/admin/feedback` |
| App suggests one next fix | ✓ — `recommendedNextFix` |
| No user flow is blocked | ✓ — fire-and-forget event, bottom card |
| No redesign or new major feature added | ✓ — surgical add-only |

---

## 7. Verdict

**READY.**

Farroway can now collect post-action feedback, group it into
canonical confusion buckets, and surface the top issue + a
recommended next fix to admins — without any user flow blocking
or major UI redesign. The system self-rate-limits to once per
session and skips setup paths so it never spams.
