import { wrapLayout } from '../templateRenderer.js';

export function renderFeedback({ fullName, issueDescription, feedbackUrl }) {
  const name = fullName || 'Farmer';
  const issue = issueDescription || 'a recent crop issue';
  const url = feedbackUrl || `${process.env.FRONTEND_BASE_URL || 'https://farroway.app'}/treatment-feedback`;

  const subject = 'Did your crop issue improve?';

  const html = wrapLayout(`
    <h2 style="color:#16a34a;margin:0 0 16px">How Is Your Crop Doing?</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, a few days ago you reported <strong>${issue}</strong>.
      We'd like to know how things are going.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.6">
      Your feedback helps us improve advice for all farmers. It only takes a moment.
    </p>
    <p style="margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Share Your Feedback
      </a>
    </p>
    <p style="font-size:13px;color:#9ca3af">
      If your issue has fully resolved, that's great! You can still let us know so we can learn from the outcome.
    </p>
  `);

  const text = [
    'Did your crop issue improve?',
    '',
    `Hello ${name},`,
    '',
    `A few days ago you reported: ${issue}`,
    'We would like to know how things are going.',
    '',
    `Share your feedback: ${url}`,
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
