# Final Release Checklist (UI)

Two columns: what's **done + gate-verified** (code), and the **on-device UI pass** that the code
environment cannot do. The second column is the real remaining UI work before the pilot.

## Done + gate-verified (code)
- [x] Rule #12 — no engineering wording on any of the 10 pages (`check:ui-page-certification`).
- [x] Honesty gates green — no fabricated diagnosis/confidence/price/metric.
- [x] Design tokens exist (color/spacing/radius/typography/shadows/motion/elevation/breakpoints).
- [x] 48px touch-target floor in CTAButton; no-color-only primitives; AA/AAA contrast tokens.
- [x] Motion durations capped 150–250ms in MOTION tokens.
- [x] Home is decision-first (single hero, deck demoted, readiness consolidated).
- [x] `build:safe` green (full gate suite).

## On-device UI pass (cannot be done from code — do before pilot)
For **each** of the 10 pages, on a real mid-range Android + an iPhone:
- [ ] **3-second test:** where am I / what do I do / why / what's next — answerable immediately.
- [ ] One hero, one primary action visually dominant; ≤2 secondary; rest are text links.
- [ ] Cards visually uniform (radius/spacing/shadow/padding) — inline-hex migrated to tokens.
- [ ] Typography readable outdoors; ≤3 weights; high contrast in sunlight.
- [ ] Touch targets ≥44px in the hand; one-handed reachable.
- [ ] **Screen reader** reads a sensible order; **dynamic type** doesn't clip.
- [ ] Animations feel fast + natural; nothing decorative.
- [ ] No raw keys / English leaks in fr/tw/sw/ha.

## Close-out
- [ ] Migrate inline-hex → tokens on the four worst pages (PlantProfile/Tasks/MyFarm/Sell) and
      re-snapshot the design-lint ratchet. (The one objective code task that raises Rule #6/#8.)
- [ ] Record the on-device pass results → flips the visual dimensions in UI_CERTIFICATION.md from
      field-pending to scored.

When both columns are green, UI is PRODUCTION-grade. Today: column 1 green, column 2 pending → ⚠
PILOT READY (UI).
