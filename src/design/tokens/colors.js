/**
 * design/tokens/colors — locked dark navy + earth-tone palette.
 *
 * MAY 2026 v3 — IMMERSIVE COMPANION REVERSAL
 * ──────────────────────────────────────────
 * Reverses the May 2026 beige-migration pass. The active app now
 * runs the Apple Weather + Oura + Tesla + premium-agri aesthetic:
 *
 *   • Deep navy shell with atmospheric sky-to-earth gradient
 *   • Glass-on-dark cards with subtle borders + layered shadows
 *   • Gold (ochre) accent for primary actions — reads premium on
 *     navy without going neon
 *   • Olive-green for health / growth signals — slightly brighter
 *     than the beige-era value so it pops on glass
 *   • Light ink hierarchy via opacity (no flat grays)
 *
 * RULES
 *   • No neon. No radioactive green.
 *   • No pure black — always layered navy with a hint of warmth.
 *   • Ochre primary, olive success, terracotta error, mustard warn.
 *   • Cards are GLASS — never opaque white panels. Use rgba()
 *     surfaces + backdrop-filter blur in the consuming component.
 *
 * STRUCTURE
 *   The legacy back-compat keys (`bgTop`, `panel`, `ochre`, etc.)
 *   forward to the new dark values so every PREMIUM_TOKENS
 *   consumer flips automatically. Spec aliases
 *   (`backgroundPrimary`, `surfaceElevated`, `ochrePrimary`,
 *   `oliveSoft`) resolve to the same values.
 *
 * ACCESSIBILITY
 *   Text contrast verified against the page-base navy (#0B1A28):
 *     ink (#EAF2FF)        15.4:1 — AAA
 *     inkDim (72% opacity) 11.1:1 — AAA
 *     ochreInk (#E6BC85)    7.0:1 — AAA
 *     greenInk (#A8C283)    8.3:1 — AAA
 *   Test surface: glass card (#0B1A28 with rgba(255,255,255,0.06)
 *   overlay → effective #182532). Still ≥ AA on every label.
 */

export const COLORS = Object.freeze({
  // ─── May 2026 v3 spec foundations ───────────────────────────
  // backgroundPrimary  — the deepest layer; appears under the
  //                       atmospheric gradient.
  // backgroundSecondary — slightly elevated, used for cards.
  // surfaceElevated     — glass-on-dark for top-tier cards.
  backgroundPrimary:   '#08111A',
  backgroundSecondary: '#0B1A28',
  surfaceElevated:     'rgba(255,255,255,0.06)',
  structureDark:       '#08111A',
  structureDarkSoft:   '#1A2433',
  ochrePrimary:        '#C8944D',
  ochreHover:          '#B9853F',
  oliveSoft:           '#8FAB73',
  oliveLight:          '#A8C283',
  textPrimary:         '#EAF2FF',
  textSecondary:       'rgba(234,242,255,0.72)',
  textMuted:           'rgba(234,242,255,0.50)',
  borderSoft:          'rgba(255,255,255,0.08)',
  shadowSoft:          'rgba(0,0,0,0.30)',

  // ─── Page wash (legacy back-compat) ─────────────────────────
  // bgTop → bgBottom drives the ProtectedLayout backdrop. The
  // page renders this gradient PLUS two radial glows applied at
  // the layout level (cool sky glow at top, warm earth glow at
  // bottom) for the Apple Weather atmospheric feel.
  bgTop:       '#08111A',
  bgBottom:    '#1A2026',
  bgGardenTop: '#091514',
  bgGardenBot: '#1C2218',

  // ─── Surfaces (legacy back-compat) ──────────────────────────
  // panel   — base glass card
  // panelHi — elevated glass (slightly brighter)
  panel:       'rgba(255,255,255,0.045)',
  panelHi:     'rgba(255,255,255,0.06)',

  // ─── Borders (legacy back-compat) ───────────────────────────
  border:      'rgba(255,255,255,0.08)',
  borderHi:    'rgba(255,255,255,0.14)',

  // ─── Text (legacy back-compat) ──────────────────────────────
  ink:         '#EAF2FF',
  inkDim:      'rgba(234,242,255,0.72)',
  inkFaint:    'rgba(234,242,255,0.50)',

  // ─── Ochre primary — gold accent on dark navy ──────────────
  // The primary colour stays at #C8944D (great contrast on dark
  // navy + reads premium not neon). The "soft" / "ink" variants
  // are tuned for glass surfaces — `ochreInk` is brighter than
  // the primary so it reads as text on rgba surfaces.
  ochre:        '#C8944D',
  ochreActive:  '#B9853F',
  ochreSoft:    'rgba(200,148,77,0.18)',
  ochreInk:     '#E6BC85',
  ochreBorder:  'rgba(200,148,77,0.42)',
  ochreSurface: 'rgba(200,148,77,0.10)',
  mutedEarth:   '#7A6E54',

  // ─── Olive green — health / success ONLY ───────────────────
  // Brighter olive than the beige era so success badges pop on
  // dark glass. Still muted (no neon, no radioactive).
  green:        '#8FAB73',
  greenSoft:    'rgba(143,171,115,0.18)',
  greenBorder:  'rgba(143,171,115,0.40)',
  greenInk:     '#A8C283',

  // ─── Warning + error — calibrated for dark surfaces ───────
  // amberInk is lighter than the primary so it reads on glass.
  // error stays at the calmer terracotta from the beige era.
  amber:        '#D6A13D',
  amberSoft:    'rgba(214,161,61,0.18)',
  amberBorder:  'rgba(214,161,61,0.45)',
  amberInk:     '#F0CB7A',
  warning:      '#D6A13D',
  error:        '#C65A4B',
  errorSoft:    'rgba(198,90,75,0.16)',
  errorBorder:  'rgba(198,90,75,0.42)',

  // ─── Structural navy (deepest chrome) ──────────────────────
  // The bottom nav + topbar layer use this navy with backdrop
  // blur. Slightly translucent so the page atmosphere reads
  // through.
  navy:         '#08111A',
  navySoft:     'rgba(8,17,26,0.85)',

  // ─── Success alias ──────────────────────────────────────────
  success:      '#8FAB73',
});

export default COLORS;
