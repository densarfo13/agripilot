# Design System Audit

Rule-by-rule status of the design system against the 12 rules. PASS = enforced/verified.
PARTIAL = implemented, debt or device-verification remains. FP = field-pending (needs a device).

| Rule | Topic | Status | Evidence |
|---|---|---|---|
| #1 | 4-question test (where/what/why/next) | **FP** | Home is decision-first (DecisionHero single hero, deck demoted). Other screens need the device 3-second test. |
| #2 | One hero / one primary action | **PARTIAL** | Home declares it in source; other pages' primary CTA is in child components (CTAButton `data-primary-action`). Recommend marking each page's primary CTA at page level. |
| #3 | Remove duplication | **PARTIAL** | Home readiness consolidated (3 cards → 1); completion/location dedupers shipped. Other screens not re-audited on device. |
| #4 | Hierarchy (hero→card→detail→history) | **FP** | Home follows it; verify the rest visually. |
| #5 | ≤1 primary + ≤2 secondary CTAs | **PARTIAL** | CTAButton has 5 variants; `check:ui-design-system` enforces one-primary on its surface list — extend the list to all 10 pages once each marks its primary. |
| #6 | Card uniformity (radius/spacing/shadow/padding) | **PARTIAL** | Tokens exist (radius/spacing/shadows/elevation); **inline-hex debt 20–52/page** is the remaining inconsistency. design-lint ratchet drives it down. |
| #7 | Typography ≤3 weights | **PASS (tokens)** | typography tokens define the scale; verify no ad-hoc weights on device. |
| #8 | One green/gold/blue/red, nothing else | **PARTIAL** | color tokens canonical; `check:ui-design-system` caps accents; inline-hex debt must reach token-only to fully certify. |
| #9 | Animation 150–250ms, no decorative | **PASS (tokens)** | MOTION tokens cap durations in range; no decorative loops in tokens. |
| #10 | Outdoor mode (contrast/targets/one-handed) | **FP** | AA/AAA contrast tokens + 48px floor exist; outdoor legibility needs a real device in sunlight. |
| #11 | WCAG AA+ / dynamic type / SR / 44px | **PARTIAL** | 48px floor (>44) + no-color-only primitives + AA tokens; **screen reader + dynamic type need a device.** |
| #12 | No engineering wording | **PASS — gate-locked** | **0 leaks across all 10 pages**; `check:ui-page-certification` now fails the build on any reintroduction. |

## The one concrete debt to close (verifiable)
**Inline-hex → tokens.** Highest: PlantProfile (52), Tasks (40), MyFarm (38), Sell (35). Migrating
these to `src/design/tokens` color refs is the single objective action that lifts Rule #6/#8 from
PARTIAL to PASS. Tracked by the design-lint ratchet (debt can only fall).

## What can't be closed from code
Rules #1, #4, #10 and the SR/dynamic-type half of #11 are **visual/interactive** — they require the
rendered app on a real device. That work is the on-device UI pass in FINAL_RELEASE_CHECKLIST.md, not
a code change.
