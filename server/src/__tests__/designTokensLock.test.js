/**
 * designTokensLock.test.js — locks the May 2026 v3 immersive
 * companion palette so accidental drift in `src/design/tokens/`
 * fails CI.
 *
 * History
 *   v1 (Feb 2026)  — dark green / neon (pre-restraint).
 *   v2 (May 2026)  — beige migration. Locked Soft Ochre.
 *   v3 (May 2026)  — immersive companion reversal. Operator
 *                    request: revert to dark navy + earth-tone
 *                    glass aesthetic (Apple Weather + Oura +
 *                    Tesla + premium agri). Ochre stays as the
 *                    primary action; olive shifts brighter so it
 *                    pops on glass. Every value below is the
 *                    locked source of truth — any change
 *                    requires an explicit doc + design review.
 */

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

describe('design/tokens/colors — locked palette', () => {
  it('primary action uses the locked ochre #C8944D', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.ochre).toBe('#C8944D');
    expect(COLORS.ochreActive).toBe('#B9853F');
  });

  it('surface is glass-on-dark (immersive companion v3)', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // Cards are NOT opaque white panels anymore — they're
    // translucent overlays that sit on the atmospheric page.
    expect(COLORS.panel).toBe('rgba(255,255,255,0.045)');
    expect(COLORS.panelHi).toBe('rgba(255,255,255,0.06)');
    // Page base is the deepest navy in the stack; the atmospheric
    // gradient + radial glows are applied at the layout level.
    expect(COLORS.bgTop).toBe('#08111A');
  });

  it('navy structural color is the deepest layer', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.navy).toBe('#08111A');
  });

  it('success accent stays muted olive (no neon, brighter for glass)', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // v3 lifts olive slightly so success badges read on glass
    // surfaces. Still muted (no neon, no radioactive).
    expect(COLORS.oliveSoft).toBe('#8FAB73');
    expect(COLORS.success).toBe('#8FAB73');
    expect(COLORS.green).toBe('#8FAB73');
    // Sanity — no #00FF style neon allowed.
    const banned = ['#00FF00', '#22FF22', '#39FF14', '#7FFF00', '#22C55E', '#16A34A'];
    expect(banned).not.toContain(COLORS.oliveSoft);
    expect(banned).not.toContain(COLORS.success);
  });

  it('May 2026 v3 immersive companion keys are present', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    expect(COLORS.backgroundPrimary).toBe('#08111A');
    expect(COLORS.backgroundSecondary).toBe('#0B1A28');
    expect(COLORS.surfaceElevated).toBe('rgba(255,255,255,0.06)');
    expect(COLORS.structureDark).toBe('#08111A');
    expect(COLORS.structureDarkSoft).toBe('#1A2433');
    expect(COLORS.ochrePrimary).toBe('#C8944D');
    expect(COLORS.ochreHover).toBe('#B9853F');
    expect(COLORS.oliveLight).toBe('#A8C283');
    // Text scale flips light for dark surfaces.
    expect(COLORS.textPrimary).toBe('#EAF2FF');
    expect(COLORS.textSecondary).toBe('rgba(234,242,255,0.72)');
    expect(COLORS.textMuted).toBe('rgba(234,242,255,0.50)');
    expect(COLORS.borderSoft).toBe('rgba(255,255,255,0.08)');
    expect(COLORS.shadowSoft).toBe('rgba(0,0,0,0.30)');
  });

  it('warning + error shift to the calmer spec values', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // warning #E0A238 → #D6A13D (warmer mustard)
    // error   #D14D4D → #C65A4B (calmer terracotta)
    expect(COLORS.warning).toBe('#D6A13D');
    expect(COLORS.error).toBe('#C65A4B');
    expect(COLORS.amber).toBe('#D6A13D');   // legacy alias forwards
  });

  it('text scale uses the immersive light ink trio', async () => {
    const { COLORS } = await import('../../../src/design/tokens/colors.js');
    // v3 — light text on dark surfaces with opacity hierarchy.
    expect(COLORS.ink).toBe('#EAF2FF');
    expect(COLORS.inkDim).toBe('rgba(234,242,255,0.72)');
    expect(COLORS.inkFaint).toBe('rgba(234,242,255,0.50)');
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
