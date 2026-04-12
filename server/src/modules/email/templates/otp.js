import { wrapLayout } from '../templateRenderer.js';

export function renderOtp({ fullName, otpCode, expiryMinutes }) {
  const name = fullName || 'there';
  const expiry = expiryMinutes || 10;

  const subject = 'Verify your Farroway account';

  const html = wrapLayout(`
    <h2 style="color:#16a34a;margin:0 0 16px">Verify Your Email</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, use the code below to verify your Farroway account.
    </p>
    <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#16a34a;font-family:monospace">${otpCode}</span>
    </div>
    <p style="font-size:14px;color:#6b7280;line-height:1.5">
      This code expires in <strong>${expiry} minutes</strong>.
    </p>
    <p style="font-size:13px;color:#9ca3af;margin-top:24px">
      If you did not request this verification, you can safely ignore this email.
      Your account will not be affected.
    </p>
  `);

  const text = [
    `Hello ${name},`,
    '',
    'Your Farroway verification code:',
    '',
    `  ${otpCode}`,
    '',
    `This code expires in ${expiry} minutes.`,
    '',
    'If you did not request this, please ignore this email.',
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
