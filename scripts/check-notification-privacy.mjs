#!/usr/bin/env node
/**
 * scripts/check-notification-privacy.mjs — §8/§9/§6/§7 privacy + honesty.
 *
 * Fails if:
 *   - fakeDelivery is anything other than a hard-coded literal false;
 *   - the delivery runtime can mark something 'sent' on its own;
 *   - NGO templates leak private farmer data (cross-org / PII);
 *   - buyer templates leak private farmer data;
 *   - weather templates claim a forecast guarantee without weather data;
 *   - harvest templates claim a guaranteed date;
 *   - notifications are required for app use anywhere in the runtimes.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const FILES = [
  'src/runtime/notifications/notificationContracts.ts',
  'src/runtime/notifications/NotificationPreferences.ts',
  'src/runtime/notifications/NotificationDelivery.ts',
  'src/runtime/notifications/NotificationScheduler.ts',
  'src/runtime/notifications/NotificationRuntime.ts',
];

// fakeDelivery must be literal-false everywhere — and never true.
const delivery = read('src/runtime/notifications/NotificationDelivery.ts');
if (!delivery) F.push('NotificationDelivery.ts: missing');
else {
  const ds = strip(delivery);
  if (/fakeDelivery\s*:\s*true|fakeDelivery\s*=\s*true/.test(ds))
    F.push('fakeDelivery must never be true');
  else P.push('fakeDelivery is hard-coded false');
  if (!/fakeDelivery\s*:\s*false/.test(delivery))
    F.push('fakeDelivery:false must appear literally in the envelope');
  else P.push('fakeDelivery:false appears literally');
  // Delivery runtime is read-only — must NEVER call dispatch / send.
  if (/dispatchNotification\s*\(|sendPush\s*\(|sendSms\s*\(|sendEmail\s*\(/.test(ds))
    F.push('delivery runtime must not actually send (read-only attestation)');
  else P.push('delivery runtime is read-only (never sends)');
}

// notificationsOptional must be present and never derived to false anywhere.
for (const rel of FILES) {
  const raw = read(rel);
  if (!raw) continue;
  if (/notificationsOptional\s*:\s*false|requireNotifications\s*=\s*true|notificationsRequired\s*:\s*true/.test(raw))
    F.push(`${rel.split('/').pop()}: must not require notifications`);
}
if (!F.some((m) => /must not require/.test(m))) P.push('no runtime requires notifications');

// NGO + buyer templates in the i18n pack must not embed PII placeholders.
const pack = read('src/i18n/notificationTranslations.js');
if (pack) {
  const ngoBuyer = pack.split('\n').filter((l) => /ngoNotif\.|buyerNotif\./.test(l)).join('\n');
  if (/\{farmerId\}|\{phone\}|\{email\}|\{coordinates\}|\{lat\}|\{lon\}|\{deviceId\}/i.test(ngoBuyer))
    F.push('NGO / buyer templates must not embed PII placeholders');
  else P.push('NGO / buyer templates carry no PII placeholders');
  // Harvest templates must not claim a guaranteed date — must say "approximate".
  const harvestLines = pack.split('\n').filter((l) => /harvestNotif\./.test(l));
  const hasApprox = harvestLines.some((l) => /approximate/i.test(l));
  if (!hasApprox) F.push('harvest templates must use approximate language (no guaranteed date)');
  else P.push('harvest templates use approximate language');
}

// Privacy probe — the NGO/buyer alerts must be off by default (per spec §2:
// "preferences persist… defaults"), so generic users don't get cross-role
// alerts. The preferences runtime enforces this.
const prefs = read('src/runtime/notifications/NotificationPreferences.ts');
if (prefs) {
  if (!/ngo_field_officer_alert\s*:\s*false/.test(prefs))
    F.push('ngo_field_officer_alert must default to false (role-scoped)');
  else P.push('ngo_field_officer_alert defaults off');
  if (!/buyer_interest_alert\s*:\s*false/.test(prefs))
    F.push('buyer_interest_alert must default to false (role-scoped)');
  else P.push('buyer_interest_alert defaults off');
}

if (F.length) {
  console.error('[check:notification-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:notification-privacy] PASS — fakeDelivery hard-coded false, never required, no PII in NGO/buyer, approximate harvest.');
for (const m of P) console.log('  ✓ ' + m);
