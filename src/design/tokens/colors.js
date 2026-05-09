/**
 * design/tokens/colors — locked Soft Ochre / Beige palette.
 *
 * MAY 2026 BEIGE MIGRATION PASS
 * ─────────────────────────────
 * Spec mandate. EVERY component reads colours from here OR
 * from the legacy `src/components/premium/tokens.js` re-export.
 * No hardcoded hex values are allowed in component files.
 *
 * RULES
 *   • Ochre = primary action / active state.
 *   • Olive earth-green = health / success ONLY (muted, never neon).
 *   • Beige = calm background + surfaces.
 *   • Navy = navigation structure only.
 *   • No neon. No radioactive green. No bloom gradients.
 *
 * STRUCTURE
 *   The shape mirrors PREMIUM_TOKENS (legacy back-compat keys
 *   like `bgTop`, `panel`, `ochre`, `green`) AND exposes the
 *   May 2026 spec aliases (`backgroundPrimary`,
 *   `surfaceElevated`, `ochrePrimary`, `oliveSoft`, etc.) so
 *   call sites can pick whichever shape reads better.
 *
 *   Both shapes resolve to the SAME colour values, so a future
 *   call-site sweep can rename without changing the rendered
 *   pixels.
 *
 * AUDITED VALUES (May 2026 beige-migration spec §2)
 *   backgroundPrimary   #F6F1E7
 *   backgroundSecondary #FFF9F0
 *   surfaceElevated     #FFFFFF
 *   structureDark       #24313A
 *   structureDarkSoft   #324250  ← NEW (top-bar gradient stop)
 *   ochrePrimary        #C8944D
 *   ochreHover          #B9853F
 *   oliveSoft           #6E8B61  ← NEW (success accent)
 *   oliveLight          #A6B89A  ← NEW (success surface)
 *   textPrimary         #1F2933
 *   textSecondary       #667085
 *   textMuted           #98A2B3
 *   borderSoft          rgba(36,49,58,0.08)
 *   shadowSoft          rgba(15,23,42,0.06)
 *   success             #6E8B61
 *   warning             #D6A13D  ← shifted from #E0A238 (warmer)
 *   error               #C65A4B  ← shifted from #D14D4D (calmer)
 */

export const COLORS = Object.freeze({
  // ─── May 2026 spec foundations ──────────────────────────────
  backgroundPrimary:   '#F6F1E7',
  backgroundSecondary: '#FFF9F0',
  surfaceElevated:     '#FFFFFF',
  structureDark:       '#24313A',
  structureDarkSoft:   '#324250',
  ochrePrimary:        '#C8944D',
  ochreHover:          '#B9853F',
  oliveSoft:           '#6E8B61',
  oliveLight:          '#A6B89A',
  textPrimary:         '#1F2933',
  textSecondary:       '#667085',
  textMuted:           '#98A2B3',
  borderSoft:          'rgba(36,49,58,0.08)',
  shadowSoft:          'rgba(15,23,42,0.06)',

  // ─── Page wash (legacy back-compat) ─────────────────────────
  bgTop:       '#F6F1E7',
  bgBottom:    '#EFE7D5',
  bgGardenTop: '#F8F2E5',
  bgGardenBot: '#F1E6D0',

  // ─── Surfaces (legacy back-compat) ──────────────────────────
  panel:       '#FFF9F0',
  panelHi:     '#FFFFFF',

  // ─── Borders (legacy back-compat) ───────────────────────────
  border:      'rgba(36,49,58,0.08)',
  borderHi:    'rgba(36,49,58,0.14)',

  // ─── Text (legacy back-compat) ──────────────────────────────
  ink:         '#1F2933',
  inkDim:      '#667085',
  inkFaint:    '#98A2B3',

  // ─── Ochre primary (legacy back-compat) ─────────────────────
  ochre:        '#C8944D',
  ochreActive:  '#B9853F',
  ochreSoft:    '#F2E3C3',
  ochreInk:     '#7A5A28',
  ochreBorder:  'rgba(200,148,77,0.42)',
  ochreSurface: 'rgba(200,148,77,0.10)',
  mutedEarth:   '#BFA98A',

  // ─── Earth green — health / success ONLY ────────────────────
  // Spec §2 calls this `oliveSoft` (#6E8B61). The legacy
  // `green` key forwards to the same value so success badges /
  // health chips picked up the warmer olive shade automatically.
  green:        '#6E8B61',
  greenSoft:    'rgba(110,139,97,0.12)',
  greenBorder:  'rgba(110,139,97,0.32)',
  greenInk:     '#3F6A3F',

  // ─── Warning + error (May 2026 — shifted to spec values) ───
  // warning was #E0A238 → now #D6A13D (warmer mustard)
  // error   was #D14D4D → now #C65A4B (calmer terracotta)
  amber:        '#D6A13D',
  amberSoft:    'rgba(214,161,61,0.14)',
  amberBorder:  'rgba(214,161,61,0.40)',
  amberInk:     '#8A5C12',
  warning:      '#D6A13D',  // spec alias
  error:        '#C65A4B',
  errorSoft:    'rgba(198,90,75,0.10)',
  errorBorder:  'rgba(198,90,75,0.30)',

  // ─── Structural navy (legacy back-compat) ──────────────────
  navy:         '#24313A',
  navySoft:     'rgba(36,49,58,0.92)',

  // ─── Success alias (May 2026) ──────────────────────────────
  // Spec §2 calls success `#6E8B61`. Legacy `green` is the
  // same colour; this alias makes call sites read more
  // semantically.
  success:      '#6E8B61',
});

export default COLORS;
