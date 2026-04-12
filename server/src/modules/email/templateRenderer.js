/**
 * Template Renderer — maps template names to render functions.
 *
 * Each template function returns { subject, html, text }.
 * Templates use a shared layout wrapper for consistent branding.
 */

import { TEMPLATES } from './constants.js';
import { renderWelcome } from './templates/welcome.js';
import { renderOtp } from './templates/otp.js';
import { renderPestAlert } from './templates/pestAlert.js';
import { renderRegionalWatch } from './templates/regionalWatch.js';
import { renderFeedback } from './templates/feedback.js';
import { renderOnboardingReminder } from './templates/onboardingReminder.js';
import { renderPasswordReset } from './templates/passwordReset.js';

const RENDERERS = {
  [TEMPLATES.WELCOME]:             renderWelcome,
  [TEMPLATES.VERIFICATION_OTP]:    renderOtp,
  [TEMPLATES.PEST_ALERT]:          renderPestAlert,
  [TEMPLATES.REGIONAL_WATCH]:      renderRegionalWatch,
  [TEMPLATES.FEEDBACK_FOLLOWUP]:   renderFeedback,
  [TEMPLATES.ONBOARDING_REMINDER]: renderOnboardingReminder,
  [TEMPLATES.PASSWORD_RESET]:      renderPasswordReset,
};

/**
 * Render an email template by name.
 * @param {string} templateName
 * @param {object} vars
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderTemplate(templateName, vars) {
  const renderer = RENDERERS[templateName];
  if (!renderer) {
    throw new Error(`Unknown email template: ${templateName}`);
  }
  return renderer(vars);
}

// ─── Shared layout ───────────────────────────────────────────

export function wrapLayout(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#16a34a;padding:16px 24px">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px">Farroway</span>
    </div>
    <div style="padding:24px">
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#fafafa">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
        &copy; ${new Date().getFullYear()} Farroway &mdash; Agricultural intelligence for smallholder farmers.<br/>
        This is an automated message. Please do not reply directly.<br/>
        Need help? Contact <a href="mailto:support@farroways.com" style="color:#16a34a">support@farroways.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
