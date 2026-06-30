# UX Governor

Goal: measure whether each screen reduces thinking, increases confidence, and encourages action.

## The rubric (Design Score, out of 100)
clarity (15) · consistency (15) · spacing/hierarchy (15) · copy (10) · accessibility (15) ·
responsiveness (10) · performance (10) · farmer experience (10). **Target ≥ 95** → below 95 fails review.

## Honest status — NOT auto-scored
A trustworthy Design Score needs a **rendered app + a human/device harness** judging clarity,
hierarchy, and farmer experience, plus runtime metrics (tap count, scroll depth, decision time,
first-paint). This sandbox cannot render the authenticated app, so Farroway does **not** emit a
fabricated automatic score — a 95 you cannot trust is worse than no number (honesty doctrine).

What IS governed automatically (the objective slices):
- **Consistency** → `check:design-lint` + `check:design-system-v1`.
- **Copy** → `check:copy-governor` + jargon gates.
- **Accessibility (structural)** → 48px floor + no-color-only primitives (`check:design-system-v1`).
- **One primary action** → `check:ui-design-system`.
- **Screen purpose/question/CTA** → `check:screen-contract`.

## How the score gets produced (when instrumented)
The remaining slices (clarity / hierarchy / responsiveness / performance / UX metrics) are scored
during **device/pilot testing**: render each screen, capture first-paint + interaction timings, run
an accessibility audit, and a reviewer rates clarity/hierarchy against SCREEN_STANDARDS.md. Until
that instrumentation exists, those slices are reported **field-pending**, not as a green number.

## Regression warnings
Once UX metrics are instrumented, the governor warns if tap count, scroll depth, reading complexity,
or visual complexity regress between releases. Today the *consistency* regression guard is live
(the design-lint + copy-governor ratchets); the *experience-metric* guard is the next instrumentation step.
