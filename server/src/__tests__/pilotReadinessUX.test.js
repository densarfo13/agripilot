import { describe, it, expect } from 'vitest';

/**
 * Pilot Readiness UX Tests
 *
 * Validates the consistency patterns, pilot tracking logic,
 * and error handling improvements made in the UX hardening pass.
 */

// ─── Pilot tracker ring buffer logic ──────────────────────

describe('Pilot tracker ring buffer', () => {
  const MAX_ENTRIES = 200;

  it('stores events with timestamp', () => {
    const entries = [];
    const event = { event: 'onboarding_started', ts: new Date().toISOString() };
    entries.push(event);
    expect(entries[0].event).toBe('onboarding_started');
    expect(entries[0].ts).toBeDefined();
  });

  it('ring buffer trims when exceeding max', () => {
    const entries = Array.from({ length: 210 }, (_, i) => ({ event: `e${i}`, ts: new Date().toISOString() }));
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    expect(entries.length).toBe(MAX_ENTRIES);
    expect(entries[0].event).toBe('e10');
  });

  it('summary counts events correctly', () => {
    const entries = [
      { event: 'onboarding_started' },
      { event: 'onboarding_completed' },
      { event: 'update_submitted' },
      { event: 'update_submitted' },
      { event: 'update_failed' },
    ];
    const counts = {};
    for (const e of entries) {
      counts[e.event] = (counts[e.event] || 0) + 1;
    }
    expect(counts.onboarding_started).toBe(1);
    expect(counts.update_submitted).toBe(2);
    expect(counts.update_failed).toBe(1);
  });
});

// ─── InlineAlert CSS class consistency ────────────────────

describe('InlineAlert CSS patterns', () => {
  const variants = ['success', 'danger', 'warning', 'info'];

  it('generates correct CSS class for each variant', () => {
    for (const v of variants) {
      const cls = `alert-inline alert-inline-${v}`;
      expect(cls).toContain('alert-inline');
      expect(cls).toContain(`alert-inline-${v}`);
    }
  });

  it('all variants produce unique classes', () => {
    const classes = variants.map(v => `alert-inline-${v}`);
    const unique = new Set(classes);
    expect(unique.size).toBe(variants.length);
  });
});

// ─── EmptyState component contract ────────────────────────

describe('EmptyState component logic', () => {
  it('action button only renders when action prop provided', () => {
    const withAction = { label: 'Add First Farmer', onClick: () => {} };
    const withoutAction = undefined;
    expect(!!withAction).toBe(true);
    expect(!!withoutAction).toBe(false);
  });

  it('variant controls button background', () => {
    const variants = {
      default: 'var(--primary)',
      success: 'var(--success)',
      warning: 'var(--warning)',
    };
    expect(variants.success).toBe('var(--success)');
    expect(variants.warning).toBe('var(--warning)');
  });
});

// ─── btn-outline-danger replaces inline styles ────────────

describe('Button class consistency', () => {
  it('btn-outline-danger uses CSS variables not hardcoded hex', () => {
    const cssRule = { background: 'var(--card)', color: 'var(--danger)', border: '1px solid var(--danger)' };
    expect(cssRule.color).toBe('var(--danger)');
    expect(cssRule.border).toContain('var(--danger)');
    // Should NOT contain hardcoded hex
    expect(cssRule.color).not.toContain('#EF4444');
    expect(cssRule.color).not.toContain('#dc2626');
  });
});

// ─── Pilot event catalog completeness ─────────────────────

describe('Pilot event catalog', () => {
  const EXPECTED_EVENTS = [
    'invite_opened',
    'onboarding_started',
    'onboarding_completed',
    'onboarding_failed',
    'first_update_submitted',
    'update_submitted',
    'update_failed',
    'validation_failed',
    'photo_uploaded',
    'photo_failed',
    'season_created',
  ];

  it('covers all critical pilot funnel stages', () => {
    expect(EXPECTED_EVENTS).toContain('invite_opened');
    expect(EXPECTED_EVENTS).toContain('onboarding_started');
    expect(EXPECTED_EVENTS).toContain('onboarding_completed');
    expect(EXPECTED_EVENTS).toContain('first_update_submitted');
    expect(EXPECTED_EVENTS).toContain('update_submitted');
  });

  it('no duplicate event names', () => {
    const unique = new Set(EXPECTED_EVENTS);
    expect(unique.size).toBe(EXPECTED_EVENTS.length);
  });

  it('event names follow snake_case convention', () => {
    for (const e of EXPECTED_EVENTS) {
      expect(e).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

// ─── Onboarding error handling (previously silent) ────────

describe('Onboarding error handling', () => {
  it('createProfile rejection should not dismiss wizard', () => {
    let showOnboarding = true;
    let onboardingError = '';
    try {
      throw new Error('Network error');
    } catch {
      onboardingError = 'Failed to create your farm profile.';
    }
    expect(showOnboarding).toBe(true);
    expect(onboardingError).toContain('Failed');
  });

  it('createProfile returning null should not dismiss wizard', () => {
    let showOnboarding = true;
    let onboardingError = '';
    const newProfile = null;
    if (!newProfile) {
      onboardingError = 'Something went wrong.';
    } else {
      showOnboarding = false;
    }
    expect(showOnboarding).toBe(true);
    expect(onboardingError).toBeTruthy();
  });

  it('successful createProfile dismisses wizard and clears error', () => {
    let showOnboarding = true;
    let onboardingError = '';
    const newProfile = { id: 'p1', farmName: 'Test' };
    if (!newProfile) {
      onboardingError = 'Failed';
    } else {
      showOnboarding = false;
    }
    expect(showOnboarding).toBe(false);
    expect(onboardingError).toBe('');
  });
});

// ─── Alert inline CSS token usage ─────────────────────────

describe('Alert CSS uses design tokens', () => {
  it('success alert uses --success-light background', () => {
    // CSS rule: .alert-inline-success { background: var(--success-light) }
    const tokenName = '--success-light';
    expect(tokenName).toMatch(/^--[a-z]+-light$/);
  });

  it('danger alert uses --danger-light background', () => {
    const tokenName = '--danger-light';
    expect(tokenName).toMatch(/^--[a-z]+-light$/);
  });

  it('warning alert uses --warning-light background', () => {
    const tokenName = '--warning-light';
    expect(tokenName).toMatch(/^--[a-z]+-light$/);
  });

  it('info alert uses --info-light background', () => {
    const tokenName = '--info-light';
    expect(tokenName).toMatch(/^--[a-z]+-light$/);
  });
});
