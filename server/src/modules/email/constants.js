/**
 * Email Constants — sender identities, template names, and configuration.
 *
 * All public-facing emails use @farroways.com sender domain.
 * Canonical app domain: farroway.app
 * Environment variables override defaults when set.
 */

// ─── Sender Identities ──────────────────────────────────────

export const SENDERS = {
  SUPPORT:       { email: process.env.EMAIL_FROM_SUPPORT       || 'support@farroways.com',       name: 'Farroway Support' },
  NO_REPLY:      { email: process.env.EMAIL_FROM_NO_REPLY      || 'no-reply@farroways.com',      name: 'Farroway' },
  NOTIFICATIONS: { email: process.env.EMAIL_FROM_NOTIFICATIONS || 'notifications@farroways.com', name: 'Farroway Alerts' },
  ONBOARDING:    { email: process.env.EMAIL_FROM_ONBOARDING    || 'onboarding@farroways.com',    name: 'Farroway Onboarding' },
  REPORTS:       { email: process.env.EMAIL_FROM_REPORTS       || 'reports@farroways.com',       name: 'Farroway Reports' },
};

// ─── Template Names ──────────────────────────────────────────

export const TEMPLATES = {
  WELCOME:               'welcome',
  VERIFICATION_OTP:      'verification_otp',
  PEST_ALERT:            'pest_alert',
  REGIONAL_WATCH:        'regional_watch',
  FEEDBACK_FOLLOWUP:     'feedback_followup',
  ONBOARDING_REMINDER:   'onboarding_reminder',
  PASSWORD_RESET:        'password_reset',
};

// ─── Confidence Thresholds ───────────────────────────────────

export const PEST_ALERT_MIN_CONFIDENCE = 0.6;
export const REGIONAL_WATCH_MIN_CONFIDENCE = 0.5;

// ─── Deliverability Notes ────────────────────────────────────
// Active provider: Zoho Mail SMTP. All transactional mail flows
// through the single SMTP_USER mailbox (see lib/mailer.js). The
// per-purpose SENDERS map above is preserved for in-app labelling
// only — the envelope From is always EMAIL_FROM, because Zoho
// rejects envelopes that don't match the authenticated account.
//
// Before production email delivery:
// 1. Verify farroway.app (and any aliases) in Zoho Mail Admin →
//    Domains → Add Domain, then complete ownership + MX steps.
// 2. Configure SPF:  farroway.app TXT "v=spf1 include:zoho.com ~all"
// 3. Configure DKIM: enable in Zoho Mail Admin → Email Configuration
//    → DKIM, then add the CNAME / TXT record Zoho shows for your
//    selector (usually `zoho._domainkey`).
// 4. DMARC: _dmarc.farroway.app TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@farroway.app"
// 5. Create an app password at https://accounts.zoho.com → Security
//    → App Passwords and use it for SMTP_PASS (required when 2FA
//    is enabled, which it should be).
