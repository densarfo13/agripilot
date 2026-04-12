/**
 * Email Constants — sender identities, template names, and configuration.
 *
 * All public-facing emails use @farroways.com domain.
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
// Before production email delivery:
// 1. Verify all sender identities in SendGrid (or your provider)
// 2. Configure SPF record: include sendgrid.net in your DNS TXT record for farroways.com
// 3. Configure DKIM: add CNAME records provided by SendGrid
// 4. Set up DMARC: _dmarc.farroways.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@farroways.com"
// 5. Warm up sending domain gradually (start with transactional, then bulk)
