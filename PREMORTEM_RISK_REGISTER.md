# PREMORTEM_RISK_REGISTER.md

**Sprint #213 — Farroway pilot premortem.**
Date: 2026-06-19. "Assume the pilot failed in 30 days — why?"

Audit-only sprint. Most failure-prevention infrastructure already
ships (#200–#212); this register maps each of the 20 failure modes to
its existing protection (gate / health probe) and flags genuine gaps.
A new composite `__pilotPremortemHealth()` proves all 8 dimensions are
simultaneously green.

| # | Failure | Sev | Prob | Screen | Root cause | Protection / Fix | Owner | Acceptance |
|--:|---|---|---|---|---|---|---|---|
| 1 | Can't finish onboarding | High | Low | Onboarding | multi-step form | FarmerCompletion 8-step + next-step | `FarmerCompletionEngine.ts` | `__farmerCompletionHealth.farmerCompletionReady` |
| 2 | Can't add crop | High | Low | Profile | form validation | crop step + guided card | `FarmBrainBelowFold.jsx` | farm-setup card renders next=add crop |
| 3 | Can't add planting date | Med | Low | Profile | optional field skipped | guided step + reason | `FarmerCompletionContracts.ts` | step `plantingDateAdded` tracked |
| 4 | Scan fails | High | Med | Scan | camera/network | ScanStartup retry + safe shell (#59-#68) | `ScanStartupBanner.jsx` | `check:scan-permanent-stability` |
| 5 | Scan unclear too often | Med | Med | Scan | model confidence | evidence fusion + candidates, never dead-ends | `ScanEvidenceFusionEngine.ts` | `check:scan-no-dead-ends` |
| 6 | Doesn't understand result | High | Med | Scan | jargon | why + limitations + confidence breakdown | `ScanConfidenceExplainer.ts` | `check:scan-farmer-safe-language` |
| 7 | Doesn't know next step | High | Med | Home/Scan | no CTA | Today's Action + decision trace + next-best | `DecisionTraceEngine.ts` | `check:digital-agronomist` |
| 8 | Duplicate / confusing task | Med | Med | Tasks | multi-engine seeding | TaskDeduper (5-key) | `TaskDeduper.ts` | `check:task-dedup` |
| 9 | Duplicate notification | Med | Med | Notifications | repeat scheduling | NotificationDeduper + collapse | `NotificationDeduper.ts` | `check:notification-dedup` |
| 10 | Language switches, English leaks | High | Med | All | unregistered keys | #212 registered 13 escaped keys; runtime guard | `__farrowayLanguageLeaks` | `check:language-leaks-final` |
| 11 | FarmBrain empty/useless | Med | Med | Home | no data pre-pilot | FarmBrain Confidence (why+missing), guided | `FarmBrainExplanation.ts` | `__farmBrainExplanationHealth` |
| 12 | Outcome capture skipped | Med | High | Tasks | friction | Better/Same/Worse prompt (#198) | `OutcomePrompt.jsx` | `check:outcome-capture` |
| 13 | Mobile clips buttons | High | Med | All | notch/safe-area | safe-area inset (22 files) + premium shell | `RoleAwareBottomNav.jsx` | `check:mobile-safe-layout` |
| 14 | Bottom nav blocks content | Med | Med | All | fixed nav overlap | safe-area + content padding | `RoleAwareBottomNav.jsx` | `check:mobile-safe-layout` |
| 15 | Can't find language selector | Med | Low | Header | discoverability | 🌐 button + bottom sheet (#183) | `PageActions.jsx` | `check:language-selector` |
| 16 | Can't recover from errors | High | Med | All | raw errors | 10 error boundaries + SafeLoader + chunk recovery | `system/ErrorBoundary.jsx` | `errorRecoveryReady` |
| 17 | Admin can't see metrics | Med | Low | /admin | route/role | PilotAnalyticsPage + alias (#189) | `PilotAnalyticsPage.jsx` | `check:pilot-analytics` |
| 18 | Analytics NEEDS_DATA forever | **High** | **High** | /admin | **no users** | events wired; honest null until cohort | `PilotMetricsAggregator.ts` | `check:pilot-events` |
| 19 | Slow on mobile | Med | Low | All | bundle size | budget gate 2.8MB/868KB < 3MB/1.1MB | — | `check:bundle-budget` |
| 20 | Abandons before first scan | **High** | **High** | Home/Onboarding | weak first journey | guided setup + next-step + first-scan CTA | `FarmerCompletionEngine.ts` | `criticalPathReady` |

## Severity × probability — the two that matter

Risks **18** and **20** are the only High-severity / High-probability
entries — and **neither is a code defect.** Both reduce to the same
thing: **there are no pilot users yet.** Analytics read null and the
"first journey" is untested because no farmer has walked it. Every
*preventable, code-side* failure (1-17, 19) has a shipping protection
+ gate. The remaining risk is adoption, which only onboarding farmers
resolves.

## Accepted residual risks

- **Hindi 54%** — hidden by design (`enableHindiLocale:false`); no
  Hindi farmer sees a mixed screen.
- **Twi/regional translator gap** — English-fallback safe (#211 list).
- **On-device mobile** — gated structurally (safe-area), not pixel-
  verified here (preview screenshot tooling times out); recommend a
  real-device smoke test before launch.
