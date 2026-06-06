# DESIGN_SYSTEM_V1.md

**Sprint #180 — Phase 9: Farroway design system v1.**
Date: 2026-06-03
Status: foundational rules — used to score future surfaces against.

The brief: a trusted farming assistant. Not a dashboard. Not an ERP.
Not a portal.

---

## 1. Palette

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Deep Green | `#1F4D2C` | Headings, primary buttons, brand mark, active nav |
| Surface | Warm Beige | `#F6F1E7` | Page background (already used in IntelligentScanResult page bg) |
| Accent | Harvest Gold | `#C8944D` | Highlights, KPI accents, "Today's action" chip |
| Ink | Slate 900 | `#1F2933` | Primary text |
| Muted | Slate 500 | `#64748B` | Secondary text, scientific names |
| Border | Slate 100 | `rgba(31,41,51,0.06)` | Hairline borders on cards |
| Success | Emerald | `#10B981` | Healthy status pill |
| Warning | Amber | `#F59E0B` | Medium severity, "attention needed" |
| Danger | Coral | `#EF4444` | High severity only — never "error" |

**Rules**
- Never use pure black (`#000`). Use Ink `#1F2933` so the page feels warm.
- Reserve Harvest Gold for ONE element per screen (typically the
  primary action). Overuse dilutes signal.
- Danger is for severity, not for system errors. System errors are
  amber + reassuring copy ("Let's try again").

---

## 2. Typography

| Token | Size | Weight | Line | Use |
|---|---|---|---|---|
| Display | 28 px | 800 | 1.2 | Greeting, scan result plant name |
| Title | 22 px | 700 | 1.3 | Card headers |
| Body-L | 16 px | 500 | 1.5 | Primary copy (default) |
| Body | 14 px | 500 | 1.5 | Secondary copy |
| Meta | 13 px | 500 | 1.4 | Scientific name, timestamps |
| Eyebrow | 11 px | 700 | 1.4 | Card category labels (uppercase, +6% tracking) |

**Rules**
- Body-L is the default. Body-14 only inside dense rows.
- Never set type below 13 px. The grower may be reading in sunlight.
- One font family across the app — `system-ui, -apple-system, sans-serif`.
- Italic ONLY for scientific names. Never for emphasis (use weight).

---

## 3. Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`

- Card padding: 16 px horizontal, 14 px vertical (matches
  `IntelligentScanResult.STYLES.card`).
- Card-to-card gap: 12 px on mobile, 16 px on tablet+.
- Page gutters: 14 px on phones (already in use), 24 px on tablet+.
- Bottom-nav clearance: 96 px (matches current `page.padding`).

**Rules**
- Generous spacing > tight grids. The assistant breathes.
- No box-shadows beyond the existing card hairline. Trust > visual flash.

---

## 4. One primary action per screen

- Every screen has exactly ONE button using the Deep Green / Harvest
  Gold fill. Secondary actions are outlined.
- The action row on the scan result page is the canonical pattern:
  Create task (primary) · Scan again (secondary) · Save for review (secondary).
- The Home hero hosts ONE Today's Action card. Everything else demotes.

---

## 5. Navigation

| Surface | Items | Constraint |
|---|---|---|
| Bottom nav (farmer) | 5: Home · My Grow · Tasks · Progress · Scan | exactly 5; no overflow |
| Bottom nav (NGO) | 5: Dashboard · Farmers · Analytics · Reports · Tasks | role-swapped variant |
| Bottom nav (buyer) | 4-5: Marketplace · Listings · Contact · Profile | one optional slot |

**Rules**
- Never more than 5 items.
- Labels are nouns ("Tasks" not "View tasks").
- Active state: Deep Green icon + filled, label same color.
- Inactive: Slate 500 outlined icon, Slate 500 label.

---

## 6. Voice & copy

- Sentence case. Never ALL CAPS except eyebrow labels.
- Never:
  - "Confirmed" (banned by check-scan-detection-permanent)
  - "Guaranteed"
  - "100% accurate"
  - "Camera ran into a problem" (banned in grower UI)
  - "Unknown Plant" / `Plant: —` (banned by check-universal-scan §7b)
- Always:
  - "Likely match" / "Needs confirmation" / "Scan unclear"
  - "Decision support, not a guarantee."
  - Suggestive verbs ("Check soil moisture today.") never imperative shouts.
- AI buzzwords forbidden in grower UI: AI, ML, model, neural,
  algorithm. Say "Farroway" instead.

---

## 7. Trust card pattern

Every intelligence card surfaces three things, in this order:

1. **What it found** — one sentence, plain English.
2. **Why we think this** — 1-2 reasons (data sources, signals).
3. **What to do next** — one action with a single button.

If a card cannot show all three honestly, it does not render.

The scan envelope already populates `whatWeNoticed`, `whyItMatters`,
and `nextAction` to this pattern.

---

## 8. Tokens are code

These rules live in the gate, not just this doc. The
check-grower-i18n-hardcoded, check-hardcoded-grower-copy, and
check-universal-scan gates enforce the banned wording. New surfaces
that violate any of the above rules fail build:safe before merge.
