# Farroway realism asset directory

Premium agricultural visual system. May 2026 realism migration.

## Structure

```
src/assets/realism/
├── icons/        — premium line-style SVG components (HONEST ART — code-only)
└── photography/  — placeholder for documentary-grade agricultural photos
```

## Icons (src/assets/realism/icons/)

Hand-rolled premium line-style SVG components. Each icon ships as a
React component so it scales to any size without rasterisation
artefacts and renders at zero network cost. The visual language is
intentionally minimal — single-weight strokes, soft rounded joins,
no fills — so an icon at 16 px reads cleanly and at 96 px feels
premium rather than oversized.

Use via the `<RealisticIcon name="…" />` wrapper:

```jsx
import RealisticIcon from '../assets/realism/icons/RealisticIcon.jsx';

<RealisticIcon name="camera" size={48} title="Camera" />
```

## Photography (src/assets/realism/photography/)

**HONEST DISCLOSURE — May 2026:** Documentary-grade agricultural
photography requires actual production assets sourced from a
licensed photography library or commissioned shoot (real crops,
real farms, real soil close-ups, real produce). The Farroway code
agent who staged this directory cannot create or fetch those
assets — that's a content-team task with budget, licensing, and
art direction.

What this directory ships:

1. The directory structure + lazy-loading helper
2. A typed manifest contract (`manifest.js`) with the asset slots
   the UI is ready to render once production photos arrive
3. A render-time fallback so `<RealisticPhoto>` shows a calm
   ochre-tinted placeholder card when the slot is empty — never a
   broken image, never a 404

When production photos land, drop them into
`src/assets/realism/photography/<slot>.webp` and the existing
component picks them up automatically — no UI change needed.
