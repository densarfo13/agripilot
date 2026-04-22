/**
 * passwordResetEmail.test.js — locks the reset-link generation and
 * email-template contract that was causing "link missing / not
 * visible" reports:
 *   • the URL is always absolute (no relative /reset-password…)
 *   • the HTML button and the plain-text fallback share the SAME
 *     href, and both are the pre-validated reset URL
 *   • a missing / invalid APP_BASE_URL aborts the send instead of
 *     dispatching a broken email
 *   • the route handler logs reset_url_generated, dev_reset_link
 *     (demo only), email_send_start, email_sent / email_failed
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import {
  buildResetUrl,
  buildPasswordResetEmail,
} from '../../services/emailTemplates.js';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

// ─── buildResetUrl ───────────────────────────────────────────────
describe('buildResetUrl', () => {
  const TOKEN = 'a'.repeat(32);

  it('builds ${APP_BASE_URL}/reset-password?token=… when inputs are valid', () => {
    const r = buildResetUrl({ appBaseUrl: 'https://farroway.app', token: TOKEN });
    expect(r.ok).toBe(true);
    expect(r.url).toBe(`https://farroway.app/reset-password?token=${TOKEN}`);
  });

  it('trims trailing slashes from APP_BASE_URL safely', () => {
    const r1 = buildResetUrl({ appBaseUrl: 'https://farroway.app/', token: TOKEN });
    const r2 = buildResetUrl({ appBaseUrl: 'https://farroway.app//', token: TOKEN });
    const r3 = buildResetUrl({ appBaseUrl: 'https://farroway.app///  ', token: TOKEN });
    expect(r1.url).toBe(`https://farroway.app/reset-password?token=${TOKEN}`);
    expect(r2.url).toBe(`https://farroway.app/reset-password?token=${TOKEN}`);
    expect(r3.url).toBe(`https://farroway.app/reset-password?token=${TOKEN}`);
  });

  it('fails with missing_app_base_url when APP_BASE_URL is empty / unset', () => {
    for (const bad of [undefined, null, '', '   ']) {
      const r = buildResetUrl({ appBaseUrl: bad, token: TOKEN });
      expect(r.ok).toBe(false);
      expect(r.error).toBe('missing_app_base_url');
      expect(r.url).toBeNull();
    }
  });

  it('fails with invalid_app_base_url when the origin is not http(s)', () => {
    for (const bad of ['farroway.app', 'ftp://farroway.app', '/reset-password', 'javascript:alert(1)']) {
      const r = buildResetUrl({ appBaseUrl: bad, token: TOKEN });
      expect(r.ok).toBe(false);
      expect(r.error).toBe('invalid_app_base_url');
    }
  });

  it('fails with invalid_token when the token is missing or too short', () => {
    expect(buildResetUrl({ appBaseUrl: 'https://farroway.app' }).error).toBe('invalid_token');
    expect(buildResetUrl({ appBaseUrl: 'https://farroway.app', token: 'short' }).error).toBe('invalid_token');
  });

  it('URL-encodes the token so raw query characters never break the link', () => {
    const r = buildResetUrl({ appBaseUrl: 'https://farroway.app', token: 'a'.repeat(16) + '&=?#' });
    expect(r.ok).toBe(true);
    expect(r.url).toContain('%26');  // &
    expect(r.url).toContain('%3D');  // =
    expect(r.url).toContain('%3F');  // ?
    expect(r.url).toContain('%23');  // #
  });
});

// ─── buildPasswordResetEmail ─────────────────────────────────────
describe('buildPasswordResetEmail', () => {
  const URL = 'https://farroway.app/reset-password?token=' + 'a'.repeat(64);

  it('returns { subject, text, html } with the canonical subject', () => {
    const r = buildPasswordResetEmail({ resetUrl: URL });
    expect(r.subject).toBe('Reset your Farroway password');
    expect(typeof r.text).toBe('string');
    expect(typeof r.html).toBe('string');
  });

  it('throws if resetUrl is missing or relative (never sends a broken email)', () => {
    expect(() => buildPasswordResetEmail({ resetUrl: '' })).toThrow();
    expect(() => buildPasswordResetEmail({ resetUrl: '/reset-password?token=x' })).toThrow();
    expect(() => buildPasswordResetEmail({ resetUrl: 'farroway.app/reset' })).toThrow();
  });

  it('HTML body contains a visible "Reset Password" button whose href is the reset URL', () => {
    const { html } = buildPasswordResetEmail({ resetUrl: URL });
    expect(html).toContain('>Reset Password<');
    // The anchor carries the absolute href (not empty, not relative).
    expect(html).toMatch(new RegExp(`<a[^>]+href="${URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  });

  it('HTML body includes the plain-text fallback link using the SAME URL', () => {
    const { html } = buildPasswordResetEmail({ resetUrl: URL });
    // The URL appears at least twice — once in the button, once in
    // the "copy this link" row underneath it.
    const occurrences = html.split(URL).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Button not working? Copy and paste this link into your browser');
  });

  it('never produces a placeholder or empty href (no href="", no href="#")', () => {
    const { html } = buildPasswordResetEmail({ resetUrl: URL });
    expect(html).not.toMatch(/href=""/);
    expect(html).not.toMatch(/href="#"/);
    expect(html).not.toMatch(/href="undefined"/);
    expect(html).not.toMatch(/href="null"/);
  });

  it('plain-text body contains the reset URL on its own line for auto-linkification', () => {
    const { text } = buildPasswordResetEmail({ resetUrl: URL });
    const blocks = text.split(/\n\n+/).map((b) => b.trim());
    expect(blocks).toContain(URL);
  });

  it('includes an Outlook-compatible button (VML fallback)', () => {
    // MSO-only VML block for Outlook desktop — guarantees the green
    // rounded button renders when the regular <a> button is hidden.
    const { html } = buildPasswordResetEmail({ resetUrl: URL });
    expect(html).toContain('v:roundrect');
    expect(html).toContain(URL);
  });

  it('mentions the expiry in both HTML and plain text', () => {
    const r = buildPasswordResetEmail({ resetUrl: URL, expiryMinutes: 30 });
    expect(r.html).toContain('30 minutes');
    expect(r.text).toContain('30 minutes');
  });

  it('escapes the URL when injecting into attributes (defense in depth)', () => {
    // Not strictly reachable in prod because buildResetUrl uses
    // encodeURIComponent, but the template layer still escapes just
    // in case a caller bypasses the helper.
    const funky = 'https://farroway.app/reset-password?token=abc"onclick="x';
    const { html } = buildPasswordResetEmail({ resetUrl: funky });
    expect(html).not.toMatch(/onclick="x/);
  });
});

// ─── Route integration (source-string contract) ──────────────────
describe('routes/auth.js — forgot-password wiring', () => {
  const code = readFile('server/routes/auth.js');

  it('imports the canonical URL + notification helpers', () => {
    // Template rendering now lives inside notificationService so
    // the route only needs buildResetUrl for the link math +
    // sendPasswordReset for the multi-channel dispatch.
    expect(code).toContain("from '../services/emailTemplates.js'");
    expect(code).toContain('buildResetUrl');
    expect(code).toContain("from '../services/notificationService.js'");
    expect(code).toContain('notifySendPasswordReset');
    // buildPasswordResetEmail is now an internal detail of the
    // notification service — verified separately below.
    const notify = readFile('server/services/notificationService.js');
    expect(notify).toContain('buildPasswordResetEmail');
  });

  it('aborts the send and logs reset_url_build_failed when URL build fails', () => {
    expect(code).toContain('reset_url_build_failed');
    // When the URL can't be built, result must be set to a
    // well-formed failure so downstream logging + audit metadata
    // keeps working — not a throw, not a silent success.
    expect(code).toMatch(/provider:\s*'none'[\s\S]*reset_url_build_failed/);
  });

  it('logs reset_url_generated with the host on success', () => {
    expect(code).toContain('reset_url_generated host=');
  });

  it('no longer inlines a template — the HTML lives in emailTemplates.js', () => {
    expect(code).not.toMatch(/html:\s*`\s*<p>You requested a password reset/);
  });

  it('dev_reset_link echo is still gated by isDemoMode()', () => {
    expect(code).toMatch(/if\s*\(\s*isDemoMode\(\)\s*\)\s*\{\s*[\s\S]*?console\.log\(.*dev_reset_link/);
  });

  it('never writes the reset URL into the HTTP response body', () => {
    const jsonReturns = code.match(/res\.json\([^)]*\)/gs) || [];
    for (const line of jsonReturns) {
      expect(line).not.toContain('resetUrl');
      expect(line).not.toContain('rawToken');
    }
  });

  it('preserves anti-enumeration — always returns { success: true } on the happy path', () => {
    expect(code).toMatch(/return res\.json\(\{\s*success:\s*true\s*\}\)/);
  });
});
