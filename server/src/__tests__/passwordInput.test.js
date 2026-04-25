/**
 * passwordInput.test.js — locks the show/hide password toggle
 * contract without spinning up a full DOM env:
 *
 *   • PasswordInput component exists and exposes the required hooks
 *   • default input type is 'password' (source-level assertion)
 *   • toggle flips to 'text' on click state
 *   • button is type="button" (never submits the form)
 *   • onMouseDown calls preventDefault (input never loses focus)
 *   • aria-label switches between "Show password" / "Hide password"
 *   • every target page (login, signup, reset, SMS reset, accept-
 *     invite, farmer register) now imports PasswordInput
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const COMPONENT = readFile('src/components/PasswordInput.jsx');

describe('PasswordInput — component source contract', () => {
  it('defaults to type="password" and flips to "text" when revealed', () => {
    // The JSX expression must tie the input type to the revealed
    // state, not hard-code one value.
    expect(COMPONENT).toMatch(/type=\{revealed \? 'text' : 'password'\}/);
  });

  it('uses a real <button type="button"> so it never submits the form', () => {
    expect(COMPONENT).toMatch(/type="button"/);
  });

  it('calls preventDefault on mousedown so focus stays on the input', () => {
    expect(COMPONENT).toMatch(/onMouseDown=\{keepFocus\}/);
    expect(COMPONENT).toMatch(/const keepFocus[\s\S]*preventDefault/);
  });

  it('switches aria-label between "Show password" and "Hide password"', () => {
    expect(COMPONENT).toMatch(/aria-label=\{revealed \? labels\.hide : labels\.show\}/);
    expect(COMPONENT).toMatch(/show: .*'Show password'/);
    expect(COMPONENT).toMatch(/hide: .*'Hide password'/);
  });

  it('is keyboard accessible (Enter / Space toggles)', () => {
    expect(COMPONENT).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/);
  });

  it('keeps toggle state local to each instance (useState per component)', () => {
    expect(COMPONENT).toMatch(/useState\(false\)/);
  });

  it('accepts toggleAriaLabels prop for localization', () => {
    expect(COMPONENT).toMatch(/toggleAriaLabels/);
  });

  it('forwards ref to the underlying input', () => {
    expect(COMPONENT).toMatch(/forwardRef/);
    expect(COMPONENT).toMatch(/<input[\s\S]*ref=\{ref\}/);
  });

  it('reserves padding for the toggle button inside the input style', () => {
    expect(COMPONENT).toMatch(/paddingRight:\s*'2\.75rem'/);
  });
});

// ─── Integration: every target page uses the component ──────────
describe('PasswordInput — wired into target pages', () => {
  // P5.14 — LoginPage is now a redirect to /login (V2Login), so it
  // no longer hosts a password field. The canonical login is V2Login
  // (src/pages/Login.jsx) which is still asserted below.
  const cases = [
    ['src/pages/Login.jsx',               'login page'],
    ['src/pages/Register.jsx',            'signup page'],
    ['src/pages/ResetPassword.jsx',       'reset password (new + confirm)'],
    ['src/pages/ForgotPasswordSms.jsx',   'SMS reset (new + confirm)'],
    ['src/pages/AcceptInvitePage.jsx',    'accept-invite (password + confirm)'],
    ['src/pages/FarmerRegisterPage.jsx',  'farmer signup (password + confirm)'],
  ];

  for (const [file, label] of cases) {
    it(`${label} imports PasswordInput`, () => {
      const src = readFile(file);
      expect(src).toMatch(/PasswordInput/);
      expect(src).toMatch(/from ['"]\.\.\/components\/PasswordInput/);
    });
  }

  it('ResetPassword uses PasswordInput for BOTH new + confirm', () => {
    const src = readFile('src/pages/ResetPassword.jsx');
    const count = (src.match(/<PasswordInput\b/g) || []).length;
    expect(count).toBe(2);
  });

  it('ForgotPasswordSms uses PasswordInput for BOTH new + confirm', () => {
    const src = readFile('src/pages/ForgotPasswordSms.jsx');
    const count = (src.match(/<PasswordInput\b/g) || []).length;
    expect(count).toBe(2);
  });

  it('AcceptInvitePage uses PasswordInput for BOTH fields', () => {
    const src = readFile('src/pages/AcceptInvitePage.jsx');
    const count = (src.match(/<PasswordInput\b/g) || []).length;
    expect(count).toBe(2);
  });

  it('FarmerRegisterPage uses PasswordInput for BOTH fields', () => {
    const src = readFile('src/pages/FarmerRegisterPage.jsx');
    const count = (src.match(/<PasswordInput\b/g) || []).length;
    expect(count).toBe(2);
  });

  it('target pages no longer render a bare <input type="password">', () => {
    for (const [file] of cases) {
      const src = readFile(file);
      expect(src).not.toMatch(/<input[^>]+type="password"/);
    }
  });

  it('form submission logic is untouched (no password stored in visible state)', () => {
    // No page should have introduced a "revealed" or "showPassword"
    // state alongside the password state — the toggle lives ENTIRELY
    // inside PasswordInput.
    for (const [file] of cases) {
      const src = readFile(file);
      expect(src).not.toMatch(/setShowPassword/);
      expect(src).not.toMatch(/showPassword\s*,\s*setShowPassword/);
    }
  });
});
