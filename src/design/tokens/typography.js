/**
 * design/tokens/typography — locked type scale.
 *
 * Spec §3:
 *   Hero          40 / 48
 *   Section title 28 / 34
 *   Card title    22 / 28
 *   Primary body  16 / 24
 *   Secondary     14 / 20
 *   Micro labels  12 / 16
 *
 * Each tier exposes:
 *   • `size`   px integer
 *   • `line`   px integer
 *   • `weight` numeric weight
 *   • `letter` letter-spacing string
 *
 * Components import a tier and spread it into a style object so
 * size + line height + weight + tracking always travel together.
 */

export const TYPE = Object.freeze({
  hero: Object.freeze({
    size:   40,
    line:   48,
    weight: 800,
    letter: '-0.02em',
    css: Object.freeze({
      fontSize:      '40px',
      lineHeight:    '48px',
      fontWeight:    800,
      letterSpacing: '-0.02em',
    }),
  }),
  section: Object.freeze({
    size:   28,
    line:   34,
    weight: 800,
    letter: '-0.01em',
    css: Object.freeze({
      fontSize:      '28px',
      lineHeight:    '34px',
      fontWeight:    800,
      letterSpacing: '-0.01em',
    }),
  }),
  card: Object.freeze({
    size:   22,
    line:   28,
    weight: 800,
    letter: '-0.005em',
    css: Object.freeze({
      fontSize:      '22px',
      lineHeight:    '28px',
      fontWeight:    800,
      letterSpacing: '-0.005em',
    }),
  }),
  body: Object.freeze({
    size:   16,
    line:   24,
    weight: 500,
    letter: '0',
    css: Object.freeze({
      fontSize:      '16px',
      lineHeight:    '24px',
      fontWeight:    500,
      letterSpacing: '0',
    }),
  }),
  secondary: Object.freeze({
    size:   14,
    line:   20,
    weight: 500,
    letter: '0',
    css: Object.freeze({
      fontSize:      '14px',
      lineHeight:    '20px',
      fontWeight:    500,
      letterSpacing: '0',
    }),
  }),
  micro: Object.freeze({
    size:   12,
    line:   16,
    weight: 700,
    letter: '0.04em',
    css: Object.freeze({
      fontSize:       '12px',
      lineHeight:     '16px',
      fontWeight:     700,
      letterSpacing:  '0.04em',
      textTransform:  'uppercase',
    }),
  }),
});

export default TYPE;
