/**
 * voiceAssistantPlacement.test.js — Voice Assistant V2 Placement Fix.
 *
 * The Voice Assistant V2 (launcher → bottom sheet → context response
 * engine → TTS fallback) was already built. The gap was placement:
 * the launcher was scattered inside individual cards, never mounted
 * as one consistent global floating button. This fix mounts ONE
 * `<VoiceLauncher variant="floating" />` in ProtectedLayout — the
 * farmer app shell.
 *
 * Coverage (source-inspection — no React render needed):
 *   - ProtectedLayout imports + mounts the floating launcher
 *   - the mount is gated off onboarding and to farmer surfaces
 *   - the launcher lives in the auth-gated shell (never on /login)
 *   - VoiceLauncher's floating variant is a fixed, safe-area-aware
 *     FAB positioned above the BottomTabNav
 *   - tapping the launcher opens the existing assistant sheet — no
 *     separate chatbot page is introduced
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. ProtectedLayout mounts the global floating launcher ──

describe('ProtectedLayout — global floating Voice Assistant placement', () => {
  const src = read('src/layouts/ProtectedLayout.jsx');

  it('imports VoiceLauncher', () => {
    expect(src).toMatch(/import VoiceLauncher from '\.\.\/components\/voice\/VoiceLauncher\.jsx'/);
  });

  it('renders the floating launcher variant', () => {
    expect(src).toMatch(/<VoiceLauncher\s+variant="floating"\s*\/>/);
  });

  it('gates the launcher off onboarding paths', () => {
    const idx = src.indexOf('<VoiceLauncher variant="floating"');
    expect(idx).toBeGreaterThan(-1);
    // The launcher's render IIFE grew (Simple/voice-mode + hide-path
    // gating), so the onboarding gate now sits further above the launcher
    // return and uses an early-return idiom (`if (onboarding || ...) return
    // null`) instead of a `!onboarding &&` wrapper. Widen the window.
    const block = src.slice(Math.max(0, idx - 2000), idx);
    expect(block).toContain('if (onboarding || !isFarmerRoute) return null');
  });

  it('gates the launcher to farmer surfaces only', () => {
    const idx = src.indexOf('<VoiceLauncher variant="floating"');
    const block = src.slice(Math.max(0, idx - 2000), idx);
    expect(block).toMatch(/isFarmer|'farmer'/);
  });

  it('lives inside the auth-gated shell (absent on /login)', () => {
    // ProtectedLayout wraps everything in <AuthGuard> — the launcher
    // markup must sit inside that tree, so unauthenticated routes
    // never mount it.
    expect(src).toMatch(/<AuthGuard>/);
    const guardIdx = src.indexOf('<AuthGuard>');
    const launcherIdx = src.indexOf('<VoiceLauncher variant="floating"');
    expect(launcherIdx).toBeGreaterThan(guardIdx);
  });
});

// ─── 2. The floating launcher is a safe-area-aware FAB ───────

describe('VoiceLauncher — floating variant placement', () => {
  const src = read('src/components/voice/VoiceLauncher.jsx');

  it('has a dedicated floating variant', () => {
    expect(src).toMatch(/variant === 'floating'/);
  });

  it('floating FAB is fixed-position, bottom-right', () => {
    const idx = src.indexOf('const FLOATING');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 500);
    expect(block).toMatch(/position:\s*'fixed'/);
    expect(block).toMatch(/right:/);
  });

  it('floating FAB is safe-area aware + sits above the bottom nav', () => {
    const idx = src.indexOf('const FLOATING');
    const block = src.slice(idx, idx + 500);
    expect(block).toMatch(/env\(safe-area-inset-bottom/);
    // bottom offset clears the ~62px BottomTabNav
    expect(block).toMatch(/bottom:\s*'calc\(/);
  });

  it('opens the existing assistant sheet — no separate chatbot page', () => {
    expect(src).toMatch(/import VoiceAssistant from '\.\/VoiceAssistant\.jsx'/);
    expect(src).toMatch(/<VoiceAssistant\s+open=\{open\}/);
  });

  it('label comes from i18n (tSafe), not a hardcoded string', () => {
    expect(src).toMatch(/tSafe\('voice\.askFarroway'/);
  });
});
