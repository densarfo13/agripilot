import { wrapLayout } from '../templateRenderer.js';

export function renderWelcome({ fullName, appUrl, supportEmail }) {
  const name = fullName || 'Farmer';
  const url = appUrl || process.env.FRONTEND_BASE_URL || 'https://app.farroways.com';
  const support = supportEmail || 'support@farroways.com';

  const subject = 'Welcome to Farroway';

  const html = wrapLayout(`
    <h2 style="color:#16a34a;margin:0 0 16px">Welcome to Farroway, ${name}!</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      We're glad you've joined. Farroway helps smallholder farmers like you make better decisions
      with real crop intelligence and simple tools.
    </p>
    <h3 style="color:#374151;margin:24px 0 12px;font-size:15px">Get started in 3 steps:</h3>
    <ol style="padding-left:20px;color:#374151;font-size:14px;line-height:1.8">
      <li><strong>Complete your farm profile</strong> &mdash; tell us about your crop and land size</li>
      <li><strong>Submit your first pest check</strong> &mdash; take photos of your crops for analysis</li>
      <li><strong>Follow the guidance</strong> &mdash; receive action-oriented advice specific to your farm</li>
    </ol>
    <p style="margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Open Farroway
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280">
      Questions? Reach us at <a href="mailto:${support}" style="color:#16a34a">${support}</a>.
    </p>
  `);

  const text = [
    `Welcome to Farroway, ${name}!`,
    '',
    'Get started in 3 steps:',
    '1. Complete your farm profile — tell us about your crop and land size',
    '2. Submit your first pest check — take photos of your crops for analysis',
    '3. Follow the guidance — receive action-oriented advice specific to your farm',
    '',
    `Open the app: ${url}`,
    '',
    `Questions? Contact ${support}`,
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
