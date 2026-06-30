# Accessibility Standard

Farroway is used outdoors, one-handed, by low-literacy and low-vision farmers. Accessibility is
not optional polish — it's core.

## Contrast — AA minimum, AAA where measured
Verified against the navy base (`#0B1A28`) in `src/design/tokens/colors.js`:
- ink `#EAF2FF` — **15.4:1 (AAA)**
- inkDim (72%) — **11.1:1 (AAA)**
- ochreInk `#E6BC85` — **7.0:1 (AAA)**
- greenInk `#A8C283` — **8.3:1 (AAA)**
All labels stay ≥ AA on glass surfaces. Status is **never color-only** — `Badge` and `ProgressRing`
pair a shape/dot + text label with every color.

## Touch targets
**≥ 48px** for every interactive element. `CTAButton` enforces a 48px min height/target
(asserted by `check:design-system-v1`). No tap target smaller than a fingertip.

## Screen reader / VoiceOver
Real semantic elements (`<button>`, headings, `role`/`aria-label` on icon-only controls). Decorative
glyphs are `aria-hidden`. `ProgressRing` exposes `aria-label="60% — Fair"`.

## Dynamic Type
Type via `TYPE` roles (rem-based), so OS text-size scaling flows through. No fixed-px font locking.

## Reduced motion
Honor `prefers-reduced-motion`: motion ≤ 250ms and subtle by default; transitions degrade to instant
when the user requests reduced motion. No essential information conveyed by animation alone.

## Outdoor readability
High-contrast palette (above), large type, strong CTA contrast — legible in sunlight.

## Safe areas
Respect device safe-area insets (notch, home indicator); bottom nav never overlaps the iOS Safari bar
(`check:mobile-safe-layout`).

## Honest status
Token-level + primitive-level accessibility (contrast, 48px, no-color-only, semantics) is **in the
system and gate-enforced**. Full app-wide VoiceOver + dynamic-type + reduced-motion verification is a
**device test** (field-pending) — it cannot be certified from an unrendered build.
