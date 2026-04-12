import { wrapLayout } from '../templateRenderer.js';

export function renderPasswordReset({ fullName, resetUrl, expiryMinutes }) {
  const name = fullName || 'there';
  const url = resetUrl || '#';
  const expiry = expiryMinutes || 60;
  const expiryText = expiry >= 60 ? `${Math.round(expiry / 60)} hour(s)` : `${expiry} minutes`;

  const subject = 'Reset your Farroway password';

  const html = wrapLayout(`
    <h2 style="color:#16a34a;margin:0 0 16px">Reset Your Password</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, you requested a password reset for your Farroway account.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.6">
      Click the button below to set a new password. This link is valid for <strong>${expiryText}</strong>.
    </p>
    <p style="margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Reset My Password
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all">
      Or copy this link: <a href="${url}" style="color:#16a34a">${url}</a>
    </p>
    <p style="font-size:13px;color:#9ca3af;margin-top:24px">
      If you did not request this, you can safely ignore this email.
      Your password will not change unless you click the link above.
    </p>
  `);

  const text = [
    `Hello ${name},`,
    '',
    'You requested a password reset for your Farroway account.',
    `Click the link below to reset your password (valid for ${expiryText}):`,
    '',
    url,
    '',
    'If you did not request this, you can safely ignore this email.',
    'Your password will not change unless you click the link above.',
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
