import { wrapLayout } from '../templateRenderer.js';

export function renderOnboardingReminder({ fullName, nextStep, continueUrl }) {
  const name = fullName || 'Farmer';
  const step = nextStep || 'complete your farm profile';
  const url = continueUrl || process.env.FRONTEND_BASE_URL || 'https://farroway.app';

  const subject = 'Complete your Farroway setup';

  const html = wrapLayout(`
    <h2 style="color:#16a34a;margin:0 0 16px">You're Almost There!</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, you started setting up your Farroway account but haven't finished yet.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-size:14px;color:#166534">
        <strong>Next step:</strong> ${step}
      </p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6">
      Completing your setup unlocks crop monitoring, pest alerts, and personalized guidance for your farm.
    </p>
    <p style="margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Continue Setup
      </a>
    </p>
    <p style="font-size:13px;color:#9ca3af">
      If you no longer wish to use Farroway, you can simply ignore this message.
    </p>
  `);

  const text = [
    'Complete your Farroway setup',
    '',
    `Hello ${name},`,
    '',
    'You started setting up your Farroway account but haven\'t finished yet.',
    `Next step: ${step}`,
    '',
    'Completing your setup unlocks crop monitoring, pest alerts, and personalized guidance.',
    '',
    `Continue: ${url}`,
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
