# DESIGN_SYSTEM_V1.md

**Sprint #181 — Farroway Design System v1.**
Date: 2026-06-03
Status: foundational rules — used to score future surfaces against.
Reference principles (NOT designs): Emil Kowalski · Impeccable Design · TasteKiller.

The brief: a trusted farming assistant. Every screen answers
**"What should I do next?"**

---

## 1. Core principles

### 1.1 Action first
Every screen has exactly ONE primary action. The farmer should
never have to think.

### 1.2 Reduce visual noise
Forbidden on grower-facing screens:
- duplicate cards
- duplicate weather widgets
- duplicate actions
- decorative borders
- empty containers

### 1.3 Information hierarchy (top → bottom)
1. Today's Action
2. Weather Impact
3. Crop Health
4. Tasks
5. Progress

Nothing else above these.

### 1.4 Premium mobile experience
- Spacing scale: **8 · 16 · 24 · 32**
- Large headings, short descriptions
- Large tap targets (min 44 × 44 px)
- Minimal text — verbs over nouns

---

## 2. Palette

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Deep Green | `#1F4D2C` | Headings, primary buttons, brand, active nav |
| Secondary | Warm Beige | `#F6F1E7` | Page background |
| Accent | Harvest Gold | `#C8944D` | One element per screen — usually the primary CTA fill |
| Ink | Slate 900 | `#1F2933` | Primary text |
| Muted | Slate 500 | `#64748B` | Secondary text, scientific names |
| Border | Slate 100 | `rgba(31,41,51,0.06)` | Hairline borders on cards |
| Success | Emerald | `#10B981` | Healthy status pill |
| Warning | Amber | `#F59E0B` | Medium severity |
| Danger | Coral | `#EF4444` | High severity only |

**Banned**
- Random gradients
- Bright neon colors
- Multiple accent systems on one screen
- Pure black `#000`

**Rule** — max 3 accent colors per screen (primary + secondary + one severity).

---

## 3. Typography

| Token | Size | Weight | Line | Use |
|---|---|---|---|---|
| Display | 28 px | 800 | 1.2 | Greeting · plant name on scan result |
| Title | 22 px | 700 | 1.3 | Card headers |
| Body-L | 16 px | 500 | 1.5 | Primary copy (default) |
| Body | 14 px | 500 | 1.5 | Secondary copy |
| Meta | 13 px | 500 | 1.4 | Scientific name · timestamps |
| Eyebrow | 11 px | 700 | 1.4 | UPPERCASE card category, +6% tracking |

**Rules**
- Family: `system-ui, -apple-system, sans-serif`. One family across the app.
- Never set type below 13 px. The grower may be reading in sunlight.
- Italic ONLY for scientific names.
- Headings are large; descriptions are short. Bold over italic for emphasis.

---

## 4. Spacing & layout

**Scale:** `8 · 16 · 24 · 32`

| Token | Value | Use |
|---|---|---|
| `space-1` | 8 px | Inline gap (icon + label) |
| `space-2` | 16 px | Card padding · card gap |
| `space-3` | 24 px | Section gap |
| `space-4` | 32 px | Hero margin |
| `tap-target` | 44 px min | Every button, link, nav item |
| `nav-clearance` | 96 px | Bottom safe-area + nav clearance |

**Rules**
- Generous spacing > tight grids.
- No card-on-card nesting beyond one level deep.
- No box-shadows beyond the existing hairline border. Trust > visual flash.

---

## 5. One primary action per screen

| Screen | Primary action |
|---|---|
| Home | **Start** (Today's Action) |
| Scan result | **Create Task** |
| Task detail | **Complete** |
| My Farm | **Edit** (current farm) |
| My Grow / Garden | **Scan** (when no plants) / **Open** (first plant) |
| Notifications | **Open related item** |

**Rules**
- Maximum 2 buttons with primary styling per screen (one filled +
  optionally one outlined danger).
- Secondary actions are text links or ghost buttons.
- Never two filled buttons of the same color in a row.

---

## 6. Navigation

**Maximum 5 bottom-nav tabs.**

| Mode | Tabs |
|---|---|
| Farmer | Home · My Farm · Tasks · Progress · Scan |
| Garden | Home · My Grow · Tasks · Journal · Scan |
| NGO | Dashboard · Farmers · Analytics · Reports · Tasks |
| Buyer | Marketplace · Listings · Contact · Profile |

**Rules**
- Labels are nouns ("Tasks" not "View tasks").
- Active: Deep Green icon (filled) + same-color label.
- Inactive: Slate 500 outline icon + label.

---

## 7. Animations

**Subtle only.** No flashy animations.

Allowed:
- `fade` (200 ms ease-out) for card mount
- `slide` (250 ms cubic-bezier) for drawer / modal
- `micro-interactions` (100-150 ms) on buttons + checkbox

Forbidden:
- Bouncy springs, confetti, parallax, auto-playing video.
- Animations longer than 300 ms.
- Loading spinners longer than 5 s without a fallback.

---

## 8. Voice & copy

Forbidden grower-facing wording:
- "Confirmed", "Guaranteed", "100% accurate"
- "Camera ran into a problem"
- "Unknown Plant", `Plant: —`
- AI buzzwords: AI, ML, model, neural, algorithm. Say "Farroway".

Required honest fallbacks:
- "Likely match" / "Needs confirmation" / "Scan unclear"
- "Decision support, not a guarantee."
- Suggestive verbs ("Check soil moisture today.") never imperative shouts.

---

## 9. Trust card pattern

Every intelligence card surfaces three things, in this order:

1. **What it found** — one sentence, plain English.
2. **Why we think this** — 1–2 reasons (data sources, signals).
3. **What to do next** — one action with a single button.

If a card cannot show all three honestly, it does not render.
The scan envelope already populates `whatWeNoticed`, `whyItMatters`,
and `nextAction` to this pattern.

---

## 10. Build gates

These rules live in code, not just this doc.

| Gate | Rule |
|---|---|
| `check-ui-design-system` (new) | Each grower page must declare ONE `data-primary-action`; no more than 2 primary-action elements; no more than 3 accent-color literals per page |
| `check-grower-i18n-hardcoded` | All grower copy via i18n keys |
| `check-hardcoded-grower-copy` | Forbidden grower wording (Confirmed/Guaranteed/100%) |
| `check-universal-scan` §7b | No `plantName \|\| '—'` / `'Unknown Plant'` in scan UI |
| `check-no-fake-intelligence` | No fabricated yield / satellite / AI claims |
| `check-bundle-budget` | First load < 1100 KB gzip |
| `check-mobile-safe-area` | iOS safe-area handled in bottom-nav padding |
| `check-no-grower-camera-error-card` | Banned wording in camera errors |

---

## 11. Success metrics

| Metric | Where measured | Target |
|---|---|---|
| Today's Action completion % | `__todaysActionHealth` | ≥ 50% D7 |
| Task completion % | `__taskProgressAccuracy` | ≥ 60% D7 |
| Scan success % | `__scanDetectionHealth.topCandidatesVisible` | ≥ 90% |
| Follow-up completion % | `__followUpHealth` | ≥ 40% D14 |
| D7 retention | `__farmerRetentionHealth` | ≥ 35% pilot |
