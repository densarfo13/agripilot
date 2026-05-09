/**
 * designTokensLock.test.js — locks the May 2026 visual restraint
 * palette so accidental drift in `src/design/tokens/` fails CI.
 *
 * Spec §2 + §11. Every value below is the locked source of
 * truth — any change requires an explicit doc + design review.
 */

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

describe('design/tokens/colors — locked palette', () => {
  it('primary action uses the locked ochre #C8944D', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.ochre).toBe('#C8944D');
    expect(COLORS.ochreActive).toBe('#B9853F');
  });

  it('surface + background match the spec', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.panel).toBe('#FFF9F0');
    expect(COLORS.bgTop).toBe('#F6F1E7');
  });

  it('navy structural color is locked', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.navy).toBe('#24313A');
  });

  it('success accent stays muted olive earth-green (no neon)', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // May 2026 beige migration: success == oliveSoft == #6E8B61.
    // Both `green` (legacy) and `oliveSoft` (spec) and `success`
    // (semantic alias) resolve to the same value.
    expect(COLORS.oliveSoft).toBe('#6E8B61');
    expect(COLORS.success).toBe('#6E8B61');
    expect(COLORS.green).toBe('#6E8B61');
    // Sanity — no #00FF style neon allowed.
    const banned = ['#00FF00', '#22FF22', '#39FF14', '#7FFF00', '#22C55E', '#16A34A'];
    expect(banned).not.toContain(COLORS.oliveSoft);
    expect(banned).not.toContain(COLORS.success);
  });

  it('May 2026 beige migration spec §2 keys are present', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.backgroundPrimary).toBe('#F6F1E7');
    expect(COLORS.backgroundSecondary).toBe('#FFF9F0');
    expect(COLORS.surfaceElevated).toBe('#FFFFFF');
    expect(COLORS.structureDark).toBe('#24313A');
    expect(COLORS.structureDarkSoft).toBe('#324250');
    expect(COLORS.ochrePrimary).toBe('#C8944D');
    expect(COLORS.ochreHover).toBe('#B9853F');
    expect(COLORS.oliveLight).toBe('#A6B89A');
    expect(COLORS.textPrimary).toBe('#1F2933');
    expect(COLORS.textSecondary).toBe('#667085');
    expect(COLORS.textMuted).toBe('#98A2B3');
    expect(COLORS.borderSoft).toBe('rgba(36,49,58,0.08)');
    expect(COLORS.shadowSoft).toBe('rgba(15,23,42,0.06)');
  });

  it('warning + error shift to the calmer spec values', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // warning #E0A238 → #D6A13D (warmer mustard)
    // error   #D14D4D → #C65A4B (calmer terracotta)
    expect(COLORS.warning).toBe('#D6A13D');
    expect(COLORS.error).toBe('#C65A4B');
    expect(COLORS.amber).toBe('#D6A13D');   // legacy alias forwards
  });

  it('text scale uses the locked ink trio', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.ink).toBe('#1F2933');
    expect(COLORS.inkDim).toBe('#667085');
    expect(COLORS.inkFaint).toBe('#98A2B3');
  });
});

describe('design/tokens/spacing — locked scale', () => {
  it('exposes the spec scale 4/8/12/16/24/32/48', async () => {
    const { SPACING } = await import('../../../src/design/tokens/spacing.js');
    expect(SPACING.s4).toBe(4);
    expect(SPACING.s8).toBe(8);
    expect(SPACING.s12).toBe(12);
    expect(SPACING.s16).toBe(16);
    expect(SPACING.s24).toBe(24);
    expect(SPACING.s32).toBe(32);
    expect(SPACING.s48).toBe(48);
  });

  it('gap() snaps off-scale values to s16', async () => {
    const { gap } = await import('../../../src/design/tokens/spacing.js');
    expect(gap(16)).toBe('16px');
    expect(gap(13)).toBe('16px');   // off-scale → fallback
    expect(gap(48)).toBe('48px');
  });
});

describe('design/tokens/typography — locked scale', () => {
  it('hero is 40/48 weight 800', async () => {
    const { TYPE } = await import('../../../src/design/tokens/typography.js');
    expect(TYPE.hero.size).toBe(40);
    expect(TYPE.hero.line).toBe(48);
    expect(TYPE.hero.weight).toBe(800);
  });

  it('body is 16/24 weight 500', async () => {
    const { TYPE } = await import('../../../src/design/tokens/typography.js');
    expect(TYPE.body.size).toBe(16);
    expect(TYPE.body.line).toBe(24);
    expect(TYPE.body.weight).toBe(500);
  });

  it('micro labels are uppercase 12/16', async () => {
    const { TYPE } = await import('../../../src/design/tokens/typography.js');
    expect(TYPE.micro.size).toBe(12);
    expect(TYPE.micro.line).toBe(16);
    expect(TYPE.micro.css.textTransform).toBe('uppercase');
  });
});

describe('design/tokens/radius — locked scale', () => {
  it('card matches the legacy PREMIUM_TOKENS value (18)', async () => {
    const { RADIUS } = await import('../../../src/design/tokens/radius.js');
    expect(RADIUS.card).toBe(18);
    expect(RADIUS.pill).toBe(999);
  });
});

describe('design/tokens/motion — restraint', () => {
  it('tap is 140ms and shimmer is 1400ms', async () => {
    const { MOTION } = await import('../../../src/design/tokens/motion.js');
    expect(MOTION.durations.tap).toBe(140);
    expect(MOTION.durations.shimmer).toBe(1400);
    // Spec §10 — no duration above 250ms (shimmer is loop, not transition).
    expect(MOTION.durations.fade).toBeLessThanOrEqual(250);
    expect(MOTION.durations.slide).toBeLessThanOrEqual(250);
  });
});

describe('PREMIUM_TOKENS — back-compat re-export', () => {
  it('forwards to design/tokens with the locked ochre', async () => {
    const { PREMIUM_TOKENS } = await import('../../../src/components/premium/tokens.js');
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(PREMIUM_TOKENS.ochre).toBe(COLORS.ochre);
    expect(PREMIUM_TOKENS.ochre).toBe('#C8944D');
    expect(PREMIUM_TOKENS.panel).toBe(COLORS.panel);
    expect(PREMIUM_TOKENS.navy).toBe(COLORS.navy);
    expect(Object.isFrozen(PREMIUM_TOKENS)).toBe(true);
  });
});
