#!/usr/bin/env node
/**
 * smoke-email.mjs — manual one-shot smoke test for the SendGrid path.
 *
 *   node scripts/smoke-email.mjs you@example.com
 *
 * Sends a real test email through the live SendGrid provider using
 * the same `sendEmail` function the app uses in production. Reads
 * config straight from process.env — exactly as the server does.
 *
 * NOT a CI test — requires real credentials. Run it against a pilot
 * / staging environment after setting SENDGRID_API_KEY + EMAIL_FROM.
 *
 * Exits:
 *   0  on success (SendGrid accepted the message)
 *   1  on any failure (config missing, provider rejected, etc.)
 */

import { sendEmail, validateEmailConfig } from '../server/services/emailService.js';
import { buildPasswordResetEmail } from '../server/services/emailTemplates.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/smoke-email.mjs <recipient@example.com>');
  process.exit(1);
}

// 1) Boot-style validation so missing vars surface before any send.
const cfg = validateEmailConfig();
if (cfg.problems.length > 0) {
  console.error('\n✗ config problems detected:');
  for (const p of cfg.problems) console.error('  -', p);
  process.exit(1);
}

// 2) Render the real password-reset template with a canary token so
//    we exercise the exact HTML + plain-text users get in production.
const fakeResetUrl = `${process.env.APP_BASE_URL || 'https://farroway.app'}/reset-password?token=smoketest-${Date.now()}`;
const { subject, text, html } = buildPasswordResetEmail({
  resetUrl: fakeResetUrl,
  expiryMinutes: 30,
});

console.log(`\n→ sending "${subject}" to ${to} via sendgrid (from=${cfg.from})…`);
const result = await sendEmail({ to, subject, text, html, requestId: 'smoke' });

if (result.ok) {
  console.log(`✓ accepted  status=${result.statusCode}  messageId=${result.messageId || '?'}`);
  console.log('  Check the inbox + spam folder to confirm delivery and template rendering.');
  process.exit(0);
}

console.error(`\n✗ send failed  code=${result.code}  status=${result.statusCode || '?'}`);
console.error(`  details: ${result.details || '(none)'}`);
process.exit(1);
