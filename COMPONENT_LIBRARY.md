# Component Library

One import path: `src/design/components`. No custom card/button outside this system.

## The 8 canonical cards (Bible §CARD SYSTEM)

| Card | Canonical implementation | Status |
|---|---|---|
| Hero Card | `HeroCard` → `premium/PremiumPageHero` | shipped |
| Insight Card | `SectionCard` → `premium/PremiumCard` (insight variant) | shipped |
| Action Card | `SectionCard` + `CTAButton` | shipped (composition) |
| Status Card | `SectionCard` + `Badge` | shipped (composition) |
| Timeline Card | `FarmBrainBelowFold` timeline section | shipped (to extract as `TimelineCard` on first reuse) |
| Weather Card | `ImmersiveHomeHero` weather band | shipped (to extract as compact `WeatherCard` during migration) |
| Marketplace Card | `MarketInsightCard` | shipped |
| Empty State Card | `EmptyState` → `premium/PremiumEmptyState` | shipped |

> No card outside this set. New card need → extend the system, never a one-off. Extraction of
> `TimelineCard` / `WeatherCard` as standalone primitives happens when a second screen consumes them
> (Build Once — no speculative components).

## Button system — exactly five variants (`CTAButton`)

`src/design/components/CTAButton.jsx` — the ONE button. Variants: **primary · secondary · ghost ·
text · danger**. Nothing else. Every button: real `<button>`, 48px min target, `data-primary-action`
on primary. Gate `check:design-system-v1` asserts the 48px floor + token-driven colors.

## Primitives

| Primitive | File | Notes |
|---|---|---|
| `CTAButton` | `design/components/CTAButton.jsx` | the button system (5 variants) |
| `ProgressRing` | `design/components/ProgressRing.jsx` | 0–100; tone + label (never color-only) |
| `Badge` | `design/components/Badge.jsx` | status pill; dot **and** color |
| `KPIChip` | `premium/PremiumStatChip` | one stat + label |
| `SectionTitle` | `premium/PremiumSectionTitle` | section heading |
| `SkeletonLoader` | `components/SkeletonLoader` | loading placeholder |

## States (every screen)

- **Loading** → `SkeletonLoader` (skeleton, never a blank page).
- **Empty** → `EmptyState` (illustration slot + explanation + one CTA; gate `check:empty-state-guidance`).
- **Error** → friendly card: what happened · what to do · Retry · Support (no stack traces).

## Rule
> Reuse a component; never fork one. Duplicate cards/buttons are rejected by the design gates and
> the `check:design-lint` ratchet. The list above is the whole vocabulary.
