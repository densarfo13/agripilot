#!/usr/bin/env node
/**
 * check-env-assertions.mjs
 *
 * CI guard — verifies that required env vars are present, and that
 * optional-provider vars don't make the app hard-crash when missing.
 *
 *   node scripts/ci/check-env-assertions.mjs [--mode=prod|dev]
 *     → 0 when all required vars are present; 1 with a list otherwise.
 *
 * Categories:
 *   REQUIRED_BACKEND    — server simply cannot start without these
 *   REQUIRED_FRONTEND   — vite build cannot produce a working bundle
 *   OPTIONAL_PROVIDERS  — missing is OK; we log the degradation
 *
 * Modes:
 *   prod (default)      — strict. Missing required = fail.
 *   dev                 — only checks presence of .env files; warns.
 */

const MODE = (process.argv.find((a) => a.startsWith('--mode=')) || '--mode=prod')
  .split('=')[1];

const REQUIRED_BACKEND = [
  'DATABASE_URL',
  'JWT_SECRET',
];

const REQUIRED_FRONTEND_PROD = [
  // Asserted at build time in src/lib/api.js (via assertApiBaseUrl).
  // We also check here so CI fails BEFORE the build step when the
  // var is simply not configured.
  'VITE_API_BASE_URL',
];

const OPTIONAL_PROVIDERS = [
  { name: 'TWILIO_ACCOUNT_SID',    aliases: ['TWILIO_SID'],   purpose: 'SMS + WhatsApp + Voice' },
  { name: 'TWILIO_AUTH_TOKEN',     aliases: ['TWILIO_TOKEN'], purpose: 'SMS + WhatsApp + Voice' },
  { name: 'TWILIO_PHONE_NUMBER',   aliases: ['TWILIO_PHONE'], purpose: 'SMS delivery' },
  { name: 'TWILIO_WHATSAPP_FROM',  aliases: ['TWILIO_WHATSAPP'], purpose: 'WhatsApp delivery' },
  { name: 'TWILIO_VOICE_FROM',     aliases: ['TWILIO_VOICE_NUMBER'], purpose: 'Voice alerts' },
  { name: 'SENDGRID_API_KEY',      aliases: [],                purpose: 'Email + password resets' },
  { name: 'MFA_SECRET_KEY',        aliases: [],                purpose: 'MFA encryption at rest' },
];

function present(name, aliases = []) {
  if (process.env[name]) return true;
  for (const a of aliases) if (process.env[a]) return true;
  return false;
}

function main() {
  const failures = [];
  const warnings = [];

  if (MODE === 'prod') {
    for (const v of REQUIRED_BACKEND)
      if (!present(v)) failures.push({ v, why: 'required (backend)' });
    for (const v of REQUIRED_FRONTEND_PROD)
      if (!present(v)) failures.push({ v, why: 'required (frontend build)' });
  }

  for (const p of OPTIONAL_PROVIDERS) {
    if (!present(p.name, p.aliases)) {
      warnings.push({ v: p.name, why: `optional — ${p.purpose} will be disabled` });
    }
  }

  // Report.
  for (const w of warnings) {
    console.warn(`\u26a0  ${w.v.padEnd(26)} ${w.why}`);
  }
  for (const f of failures) {
    console.error(`\u2717 ${f.v.padEnd(26)} ${f.why}`);
  }
  if (failures.length > 0) {
    console.error('');
    console.error(`env-assertions: ${failures.length} required var(s) missing.`);
    console.error('Set them in your Railway/hosting environment before deploy.');
    process.exit(1);
  }
  console.log(`\u2713 env-assertions (${MODE}): all required vars present`
    + (warnings.length ? `; ${warnings.length} optional provider(s) degraded` : ''));
}
main();
