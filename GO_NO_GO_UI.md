# Go / No-Go — UI

## VERDICT: ⚠ PILOT READY (UI)

Not NOT READY. Not "✅ 95+/100 certified". The honest middle, with the reason.

## Why not NOT READY
The objective UI layer is **certifiable and green**:
- Rule #12 (no engineering wording) — **0 leaks on all 10 pages, gate-locked.**
- Honesty intact — nothing fabricated.
- Design tokens, 48px targets, AA/AAA contrast tokens, 150–250ms motion — in place.
- `build:safe` green; Home is decision-first.

The UI is safe and coherent enough to put in front of pilot farmers.

## Why not ✅ 95+/100 certified
The 95+ target is a **visual** bar — premium feel, decision speed, outdoor readability, screen
reader, dynamic type, card uniformity in the hand. **None of that is measurable from code.** This
environment cannot render the authenticated app, so a 95 visual score would be invented. Two things
are honestly open:
1. **Inline-color debt** (20–52 hex/page) — Rule #6/#8 not yet token-only. *Objective, code-fixable.*
2. **The on-device UI pass** — Rules #1/#4/#10/#11 (visual half). *Requires a device.*

I will not certify a score I cannot see. That is the same rule that keeps the product honest with
farmers.

## To reach ✅ PRODUCTION-grade UI
1. Migrate inline-hex → tokens on the 4 worst pages; re-snapshot the design-lint ratchet.
2. Run the on-device UI pass (FINAL_RELEASE_CHECKLIST.md, column 2) on real Android + iPhone.
3. Record results → the visual dimensions in UI_CERTIFICATION.md become real scores.

This converges with every other Farroway verdict — launch state PILOT_READY, scan lifecycle
DEVELOPMENT, provider cert NOT_CERTIFIED. The UI, like everything else, is **ready to begin the pilot;
the remaining proof is a real device + real farmers, not more code.**
