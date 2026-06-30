# Screen Standards

Every screen: **one purpose · one hero · one primary action · ≤5 supporting sections.**
No duplicated info. No backend words. (Enforced by `check:ui-design-system` + the language gates.)

| Screen | Question it answers | Hero | Primary action |
|---|---|---|---|
| **Home** | "What should I do today?" | Today's Priority (DecisionHero) | the day's one action |
| **My Farm** | "How is my farm doing?" | Farm Health (Good/Watch/Needs attention) | the next farm action |
| **Tasks** | "What should I complete next?" | Today's Task | Complete / Start |
| **Activity** | "What changed?" | Timeline (newest first, grouped Today/Yesterday/Week/Month) | — (read) + View all |
| **Scan** | "What is wrong with my crop?" | Camera | Scan / then Save or Retake |
| **Sell** | "What can I sell?" | Best selling opportunity (honest: no invented price) | Sell now / Enter local price |
| **Funding** | "What opportunities exist?" | Recommended program | Apply |

## Per-screen contract
- The hero is the **first card after the header** and answers the question above.
- Exactly **one** primary CTA; everything else is secondary and below.
- Setup-incomplete state shows **one** setup step that unlocks value (not agronomic advice).
- Empty/loading/error states use the canonical components (COMPONENT_LIBRARY.md) — never blank, never a dead end.

## Status
- **Home** meets this standard today (decision-first hero; one Farm Readiness card; jargon removed).
- The other screens are governed by the same standard and migrate onto it screen-by-screen; the
  `check:design-lint` ratchet tracks adoption (inline-color debt → 0). See UI_ARCHITECTURE.md.
