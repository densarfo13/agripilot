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
// Active provider: SendGrid. All transactional mail goes through the
// single EMAIL_FROM address (see services/emailService.js). The
// per-purpose SENDERS map above is preserved for in-app labelling
// only — SendGrid requires every distinct From address to be a
// verified Single Sender (or on an authenticated domain), so
// provider.js ignores the per-call `from` and uses EMAIL_FROM.
//
// Before production email delivery:
// 1. Create an API key in SendGrid → Settings → API Keys with at
//    least the "Mail Send" scope. Store it as SENDGRID_API_KEY.
// 2. Verify the sender:
//      - Fastest: Settings → Sender Authentication → Verify a Single
//        Sender, confirm admin@farroway.app by clicking the link.
//      - Better: authenticate the whole farroway.app domain via
//        Domain Authentication (adds CNAMEs for SPF/DKIM).
// 3. Configure SPF:  farroway.app TXT "v=spf1 include:sendgrid.net ~all"
// 4. Configure DKIM: the Domain Authentication wizard generates
//    three CNAMEs — add them to DNS.
// 5. DMARC: _dmarc.farroway.app TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@farroway.app"
