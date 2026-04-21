/**
 * passwordResetIntegrated.test.js — covers the integrated password
 * reset pass (logging + env validation + link generation + dev-mode
 * fallback + recovery-methods endpoint + UI source-string polish).
 *
 * These are source-string + behavioural checks that do not hit a
 * real DB or real SendGrid; they assert the contract shape so a
 * regression on any of the coordinated changes trips a red test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

// ─── Server: forgot-password logging shape ───────────────────────
describe('routes/auth.js — forgot-password logging contract', () => {
  const code = readFile('server/routes/auth.js');

  it('logs the incoming request with tag + email + ip', () => {
    expect(code).toMatch(/\[forgot-password:/);
    expect(code).toMatch(/requested email=/);
  });

  it('logs user_found=true|false after the DB lookup', () => {
    expect(code).toMatch(/user_found=\$\{userFound\}/);
  });

  it('logs token_created / email_send_start / email_sent / email_failed phases', () => {
    expect(code).toMatch(/token_created/);
    expect(code).toMatch(/email_send_start/);
    expect(code).toMatch(/email_sent/);
    expect(code).toMatch(/email_failed/);
  });

  it('uses the canonical subject line (now in the template module)', () => {
    const tpl = readFile('server/services/emailTemplates.js');
    expect(tpl).toContain("'Reset your Farroway password'");
  });

  it('writes a config_error log line when APP_BASE_URL is missing', () => {
    expect(code).toMatch(/config_error: APP_BASE_URL is not set/);
  });

  it('never logs raw tokens', () => {
    // The token variable is named rawToken; make sure it never shows
    // up inside a console.log template string.
    const logLines = code.match(/console\.(log|warn|error)\([^)]*\)/g) || [];
    for (const line of logLines) {
      expect(line).not.toMatch(/\$\{rawToken\}/);
      expect(line).not.toMatch(/\$\{tokenHash\}/);
    }
  });

  it('preserves anti-enumeration — always returns { success: true } on the happy path', () => {
    // Two places must always return the generic success:
    //   • when no active user is found
    //   • when an unexpected failure bubbles up
    expect(code).toMatch(/return res\.json\(\{\s*success:\s*true\s*\}\)/);
  });
});

// ─── Server: reset link format ───────────────────────────────────
describe('reset link generation (now via emailTemplates.buildResetUrl)', () => {
  const tpl = readFile('server/services/emailTemplates.js');

  it('builds the reset URL as APP_BASE_URL + /reset-password?token=…', () => {
    expect(tpl).toMatch(/\$\{trimmed\}\/reset-password\?token=\$\{encodeURIComponent\(token\)\}/);
  });

  it('trims trailing slashes from APP_BASE_URL before concatenation', () => {
    expect(tpl).toMatch(/\.replace\(\/\\\/\+\$\//);
  });
});

// ─── Server: dev-mode console fallback ───────────────────────────
describe('dev / demo fallback', () => {
  const code = readFile('server/routes/auth.js');

  it('echoes the reset link to the server log in non-production or demo mode', () => {
    expect(code).toMatch(/dev_reset_link \$\{resetUrl\}/);
    // The gate is now the single-source isDemoMode() helper, which
    // is true in non-production OR when DEMO_MODE=true is set.
    expect(code).toContain("from '../lib/demoMode.js'");
    expect(code).toMatch(/if\s*\(\s*isDemoMode\(\)\s*\)/);
  });

  it('never writes the reset link into an HTTP response body', () => {
    // Search for any res.json(...) that includes resetUrl — should be zero.
    const jsonReturns = code.match(/res\.json\([^)]*\)/gs) || [];
    for (const line of jsonReturns) {
      expect(line).not.toContain('resetUrl');
      expect(line).not.toContain('rawToken');
    }
  });
});

// ─── Server: recovery-methods endpoint ───────────────────────────
describe('GET /api/v2/auth/recovery-methods', () => {
  const code = readFile('server/routes/auth.js');

  it('exposes a public recovery-methods endpoint', () => {
    expect(code).toMatch(/router\.get\(['"]\/recovery-methods['"]/);
  });

  it('returns { email, sms } flags only — no user data leak', () => {
    // Any shape variant must contain both keys and nothing else from
    // the user namespace. We assert the exact frozen { email, sms }
    // return shape — commas, whitespace, and trailing comma tolerant.
    expect(code).toMatch(/res\.json\(\s*\{\s*email\s*,\s*sms\s*,?\s*\}\s*\)/);
    // Negative guard: handler must not leak user/email lookup data.
    const handler = code.split("router.get('/recovery-methods'")[1] || '';
    const body = handler.split('router.')[0] || '';
    expect(body).not.toMatch(/prisma\.user/);
    expect(body).not.toMatch(/findUnique/);
  });

  it('sms availability requires TWILIO_VERIFY_SERVICE_SID for twilio-verify', () => {
    expect(code).toMatch(/TWILIO_VERIFY_SERVICE_SID/);
  });
});

// ─── Frontend: api.js helper ─────────────────────────────────────
describe('src/lib/api.js — getRecoveryMethods', () => {
  const code = readFile('src/lib/api.js');

  it('exports a getRecoveryMethods helper that hits /recovery-methods', () => {
    expect(code).toContain('export function getRecoveryMethods');
    expect(code).toContain('/api/v2/auth/recovery-methods');
  });
});

// ─── Frontend: ForgotPassword.jsx polish ─────────────────────────
describe('src/pages/ForgotPassword.jsx — final copy + cooldown + SMS hide', () => {
  const code = readFile('src/pages/ForgotPassword.jsx');

  it('uses final title copy (no "Forgot Password" placeholder)', () => {
    expect(code).toContain("'Reset your password'");
    expect(code).not.toMatch(/'Forgot Password'/);
  });

  it('confirmation title matches the product spec', () => {
    expect(code).toContain("We\\u2019ve sent you a reset link");
  });

  it('confirmation body mentions the spam folder', () => {
    expect(code).toMatch(/inbox and spam folder/);
  });

  it('has a resend button with cooldown handling', () => {
    expect(code).toContain('RESEND_COOLDOWN_SECONDS');
    expect(code).toMatch(/data-testid="forgot-password-resend"/);
    expect(code).toMatch(/cooldown > 0/);
  });

  it('uses a 30-second resend cooldown (per spec)', () => {
    expect(code).toContain('RESEND_COOLDOWN_SECONDS = 30');
  });

  it('only renders the SMS link when recovery-methods reports sms=true', () => {
    // Conditional render guarded by smsAvailable.
    expect(code).toMatch(/\{smsAvailable\s*&&/);
  });

  it('fetches recovery-methods on mount', () => {
    expect(code).toContain('getRecoveryMethods');
  });

  it('never renders a raw provider error string to the user', () => {
    // Our friendly() mapper translates rate-limit / network shapes.
    expect(code).toContain('function friendly');
    expect(code).toMatch(/network/i);
    expect(code).toMatch(/Too many requests/);
  });

  it('has no literal placeholder words in visible copy', () => {
    // "TODO", "Placeholder", "Lorem", "WIP" and similar should not
    // appear in the rendered JSX.
    expect(code).not.toMatch(/\bTODO\b/i);
    expect(code).not.toMatch(/\bplaceholder[ _-]?text\b/i);
    expect(code).not.toMatch(/\blorem\b/i);
    expect(code).not.toMatch(/\bWIP\b/i);
  });
});

// ─── emailService contract sanity ────────────────────────────────
describe('emailService — used by the password-reset path', () => {
  const code = readFile('server/services/emailService.js');

  it('requires SENDGRID_API_KEY', () => {
    expect(code).toContain('SENDGRID_API_KEY');
  });

  it('defaults EMAIL_FROM to admin@farroway.app', () => {
    expect(code).toMatch(/EMAIL_FROM.+admin@farroway\.app/);
  });

  it('never throws — always returns { ok, code }', () => {
    expect(code).toContain('ok: true');
    expect(code).toContain('ok: false');
    expect(code).not.toMatch(/throw new Error/);
  });
});
