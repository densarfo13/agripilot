import { wrapLayout } from '../templateRenderer.js';

export function renderRegionalWatch({ fullName, regionName, riskSummary, recommendedAction, inspectionWindow, appUrl }) {
  const name = fullName || 'Farmer';
  const region = regionName || 'your area';
  const summary = riskSummary || 'Elevated pest activity has been detected in your region.';
  const action = recommendedAction || 'Monitor your crops closely and report any unusual symptoms.';
  const window = inspectionWindow || 'within the next 48 hours';
  const url = appUrl || process.env.FRONTEND_BASE_URL || 'https://farroway.app';

  const subject = 'Regional Pest Watch for Your Area';

  const html = wrapLayout(`
    <h2 style="color:#d97706;margin:0 0 16px">Regional Pest Watch</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, we've detected elevated pest activity in <strong>${region}</strong>.
    </p>
    <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:600">Area Risk Summary</p>
      <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5">${summary}</p>
    </div>
    <h3 style="color:#374151;font-size:14px;margin:20px 0 8px">Recommended Action:</h3>
    <p style="font-size:14px;color:#374151;line-height:1.6">${action}</p>
    <p style="font-size:14px;color:#6b7280;line-height:1.5">
      <strong>Inspection window:</strong> ${window}
    </p>
    <p style="margin:24px 0">
      <a href="${url}/regional-watch" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        View Regional Map
      </a>
    </p>
  `);

  const text = [
    'Regional Pest Watch for Your Area',
    '',
    `Hello ${name},`,
    '',
    `Area: ${region}`,
    `Summary: ${summary}`,
    '',
    `Recommended action: ${action}`,
    `Inspection window: ${window}`,
    '',
    `View regional map: ${url}/regional-watch`,
    '',
    '— The Farroway Team',
  ].join('\n');

  return { subject, html, text };
}
