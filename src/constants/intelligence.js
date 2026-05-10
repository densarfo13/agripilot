/** Shared color palette for intelligence pages — forwards to the
 *  unified Soft Ochre / Beige token table. Legacy keys preserved
 *  so existing intelligence-page imports keep compiling, but every
 *  value now resolves to the locked palette in
 *  `src/design/tokens/colors.js`. */

import { COLORS as TOKENS } from '../design/tokens/colors.js';

export const COLORS = Object.freeze({
  bg:         TOKENS.bgTop,         // #F6F1E7 (was dark navy)
  card:       TOKENS.panelHi,       // #FFFFFF (was #1B2330)
  cardBorder: TOKENS.borderSoft,
  green:      TOKENS.success,       // #6E8B61 (olive earth, not neon)
  greenDark:  TOKENS.success,
  greenLight: TOKENS.greenSoft,
  red:        TOKENS.error,         // #C65A4B
  amber:      TOKENS.warning,       // #D6A13D
  blue:       TOKENS.ochre,         // unified system has no info-blue
  text:       TOKENS.ink,           // #1F2933
  subtext:    TOKENS.inkDim,        // #667085
  muted:      TOKENS.inkFaint,      // #98A2B3
});

/** Risk level → color mapping. Olive earth for low (success tone),
 *  warm ochre/warning for moderate, terracotta for urgent. */
export const RISK_COLORS = Object.freeze({
  low:      TOKENS.success,         // #6E8B61
  moderate: TOKENS.warning,         // #D6A13D
  high:     TOKENS.warning,
  urgent:   TOKENS.error,           // #C65A4B
});

/** Shared inline spinner. The border-top uses the ochre primary so
 *  the loading affordance matches every other action surface. */
export const SPINNER_STYLE = Object.freeze({
  display: 'inline-block',
  width: 20,
  height: 20,
  border: '2.5px solid rgba(36,49,58,0.10)',
  borderTopColor: TOKENS.ochre,     // #C8944D
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
});
