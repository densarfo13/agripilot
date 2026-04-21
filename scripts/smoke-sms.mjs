#!/usr/bin/env node
/**
 * smoke-sms.mjs — manual one-shot smoke test for the Twilio Verify
 * OTP path.
 *
 *   node scripts/smoke-sms.mjs +14155551212
 *
 * Calls the real provider's startVerification() function and prints
 * what a farmer would receive. Follow up with:
 *
 *   node scripts/smoke-sms.mjs +14155551212 123456
 *
 * to check the OTP you got on the phone.
 *
 * NOT a CI test — requires real credentials. Run against a pilot /
 * staging environment after setting TWILIO_ACCOUNT_SID +
 * TWILIO_AUTH_TOKEN + TWILIO_VERIFY_SERVICE_SID.
 *
 * While Twilio is on trial, the recipient phone number must be
 * verified under Console → Verified Caller IDs. Unverified numbers
 * will fail with error 21608.
 *
 * Exits:
 *   0  on success
 *   1  on any failure (config missing, provider rejected, etc.)
 */

import { getActiveSmsVerificationProvider } from '../server/src/modules/auth/smsVerification/provider.js';
import { validateSmsConfig } from '../server/services/smsService.js';

const phone = process.argv[2];
const code  = process.argv[3];

if (!phone) {
  console.error('Usage:');
  console.error('  node scripts/smoke-sms.mjs <+E164>           # start');
  console.error('  node scripts/smoke-sms.mjs <+E164> <code>    # check');
  process.exit(1);
}

// 1) Config sanity — same signal the server logs at boot.
const cfg = validateSmsConfig();
if (!cfg.verify) {
  console.error('\n✗ Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID.');
  process.exit(1);
}

const provider = getActiveSmsVerificationProvider();
if (!provider || !provider.isConfigured()) {
  console.error('\n✗ Active SMS provider is not configured.');
  process.exit(1);
}

if (!code) {
  // Start a verification.
  console.log(`\n→ starting verification to ${phone} via ${provider.name}…`);
  const r = await provider.startVerification({ to: phone, channel: 'sms' });
  if (r.ok) {
    console.log(`✓ provider accepted  status=${r.status}  sid=${r.sid || '?'}`);
    console.log('  A code should arrive shortly. Re-run with the code as the second argument to check it.');
    process.exit(0);
  }
  console.error(`\n✗ start failed  status=${r.status || '?'}  error=${r.error || '(none)'}`);
  process.exit(1);
}

// Check mode.
console.log(`\n→ checking code for ${phone} via ${provider.name}…`);
const r = await provider.checkVerification({ to: phone, code });
if (r.ok && r.status === 'approved') {
  console.log(`✓ approved  sid=${r.sid || '?'}`);
  process.exit(0);
}
console.error(`\n✗ check failed  status=${r.status || '?'}  error=${r.error || '(none)'}`);
process.exit(1);
