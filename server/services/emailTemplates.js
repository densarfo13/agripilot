/**
 * emailTemplates.js — pure, testable builders for outbound email
 * bodies. Keeping the string composition out of route files lets us
 * assert (a) the URL is always absolute, (b) the button and the
 * plain-text fallback share the same href, and (c) the template
 * never renders an empty / placeholder anchor.
 *
 * Every exported builder returns { subject, text, html } so the
 * caller can hand it straight to services/emailService.sendEmail.
 */

// ─── URL helpers ─────────────────────────────────────────────────
/**
 * buildResetUrl — deterministic reset link builder.
 *
 *   { url: string, ok: true }
 *      when APP_BASE_URL is a valid absolute origin and token is
 *      non-empty. Trailing slashes on APP_BASE_URL are trimmed.
 *
 *   { url: null, ok: false, error: string }
 *      when inputs are missing/invalid. Callers must ABORT the send
 *      in this case — the previous code path happily mailed relative
 *      /reset-password?token=… URLs, which Outlook / some mobile
 *      clients render as a non-clickable span.
 *
 * This helper never throws; callers log `error` and keep the
 * anti-enumeration success response.
 */
export function buildResetUrl({ appBaseUrl, token } = {}) {
  if (!token || typeof token !== 'string' || token.length < 16) {
    return { ok: false, url: null, error: 'invalid_token' };
  }
  if (!appBaseUrl || typeof appBaseUrl !== 'string' || !appBaseUrl.trim()) {
    return { ok: false, url: null, error: 'missing_app_base_url' };
  }
  const trimmed = appBaseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/\S+/.test(trimmed)) {
    return { ok: false, url: null, error: 'invalid_app_base_url' };
  }
  const url = `${trimmed}/reset-password?token=${encodeURIComponent(token)}`;
  return { ok: true, url };
}

/**
 * Minimal HTML escape for values we interpolate into markup. We
 * only ever inject the reset URL (already validated above), but
 * belt-and-braces — no user-controlled strings land in the output.
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Password reset template ─────────────────────────────────────
/**
 * buildPasswordResetEmail — production-ready reset email.
 *
 * HTML structure:
 *   • `<html><body>` wrapper + single-column 600px table so Outlook /
 *     Gmail / Apple Mail all render the same way.
 *   • Table-based "bulletproof" button (Outlook compatible) with the
 *     reset URL as the href AND inline fg/bg styles so the CTA is
 *     visible even when style sheets are stripped.
 *   • A separate, always-visible plain-text hyperlink beneath the
 *     button ("Or copy this link to your browser") that uses the
 *     SAME href and full visible URL as its text so a farmer who
 *     can't click the button can copy-paste.
 *
 * Plain-text body:
 *   • Each line on its own paragraph so clients auto-linkify.
 *   • The raw URL sits on its own line so Gmail / iOS Mail render it
 *     as a tap target without surrounding punctuation.
 *
 * Inputs are assumed pre-validated via buildResetUrl() — passing a
 * falsy `resetUrl` throws so we never dispatch a broken email.
 */
export function buildPasswordResetEmail({ resetUrl, expiryMinutes = 30 } = {}) {
  if (!resetUrl || typeof resetUrl !== 'string' || !/^https?:\/\//.test(resetUrl)) {
    throw new Error('buildPasswordResetEmail: resetUrl must be an absolute http(s) URL');
  }
  const href = esc(resetUrl);
  const expiry = Number.isFinite(expiryMinutes) ? Math.max(1, Math.round(expiryMinutes)) : 30;

  const subject = 'Reset your Farroway password';

  // Plain text — each blank-line-separated block is its own paragraph.
  // The URL goes on its own line so it becomes a tap target in iOS
  // Mail and Gmail auto-linkifies it.
  const text = [
    'You requested a password reset for your Farroway account.',
    `Click the link below to reset your password. The link is valid for ${expiry} minutes.`,
    resetUrl,
    'If you did not request this, you can safely ignore this email — your password will not change unless you click the link above.',
    '— The Farroway team',
  ].join('\n\n');

  // Bulletproof-button HTML. Inline styles + Outlook-specific MSO
  // comment-wrapped table so every major client shows the green
  // rounded button with the white "Reset Password" label.
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${esc(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7FA;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;">
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <div style="font-size:12px;font-weight:700;color:#15803D;letter-spacing:0.08em;text-transform:uppercase;">Farroway</div>
                <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;color:#0F172A;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 4px 28px;font-size:15px;line-height:1.55;color:#0F172A;">
                <p style="margin:0 0 14px 0;">You requested a password reset for your Farroway account.</p>
                <p style="margin:0 0 20px 0;">Tap the button below to choose a new password. The link is valid for <strong>${expiry} minutes</strong>.</p>
              </td>
            </tr>
            <!-- Button (bulletproof for Outlook + web clients) -->
            <tr>
              <td align="center" style="padding:8px 28px 20px 28px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="14%" stroke="f" fillcolor="#16A34A">
                  <w:anchorlock/>
                  <center style="color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;">Reset Password</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${href}"
                   style="background:#16A34A;border-radius:8px;color:#FFFFFF;display:inline-block;font-size:16px;font-weight:700;line-height:46px;min-width:220px;padding:0 24px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;"
                   target="_blank"
                   rel="noopener"
                >Reset Password</a>
                <!--<![endif]-->
              </td>
            </tr>
            <!-- Plain-text fallback link — always visible, always clickable. -->
            <tr>
              <td style="padding:0 28px 20px 28px;font-size:13px;line-height:1.55;color:#334155;">
                <p style="margin:0 0 6px 0;color:#64748B;">Button not working? Copy and paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;"><a href="${href}" style="color:#15803D;text-decoration:underline;" target="_blank" rel="noopener">${href}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 24px 28px;font-size:13px;line-height:1.55;color:#64748B;border-top:1px solid #E2E8F0;">
                <p style="margin:12px 0 0 0;">If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password will not change unless you click the link above.</p>
                <p style="margin:10px 0 0 0;">&mdash; The Farroway team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

// ─── Internal helpers (tests only) ───────────────────────────────
export const _internal = Object.freeze({ esc });
