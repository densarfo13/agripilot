import { wrapLayout } from '../templateRenderer.js';

const LEVEL_COLORS = {
  urgent: '#dc2626',
  high: '#ea580c',
  moderate: '#d97706',
  low: '#16a34a',
};

export function renderPestAlert({ fullName, riskLevel, likelyIssue, confidenceScore, actionGuidance, appUrl }) {
  const name = fullName || 'Farmer';
  const level = riskLevel || 'moderate';
  const issue = likelyIssue || 'Potential crop stress detected';
  const confidence = confidenceScore != null ? Math.round(confidenceScore * 100) : null;
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.moderate;
  const url = appUrl || process.env.FRONTEND_BASE_URL || 'https://farroway.app';

  // Extract action guidance fields safely
  const whatToDo = actionGuidance?.whatToDoNow || actionGuidance?.recommendation || 'Check your crops and follow the in-app guidance.';
  const whereToInspect = actionGuidance?.whereToInspect || 'Start with the affected area shown in the app.';

  const subject = 'Crop Alert: Action Needed';

  const html = wrapLayout(`
    <h2 style="color:${color};margin:0 0 16px">Crop Alert: Action Needed</h2>
    <p style="font-size:15px;color:#374151;line-height:1.6">
      Hello ${name}, a recent analysis of your farm has detected an issue that needs attention.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:140px">Risk Level</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:${color};text-transform:uppercase">${level}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:13px;color:#6b7280">Likely Issue</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#374151">${issue}</td>
      </tr>
      ${confidence != null ? `
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:13px;color:#6b7280">Confidence</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#374151">${confidence}%</td>
      </tr>` : ''}
    </table>
    <h3 style="color:#374151;font-size:14px;margin:20px 0 8px">What to do now:</h3>
    <p style="font-size:14px;color:#374151;line-height:1.6">${whatToDo}</p>
    <h3 style="color:#374151;font-size:14px;margin:16px 0 8px">Where to inspect:</h3>
    <p style="font-size:14px;color:#374151;line-height:1.6">${whereToInspect}</p>
    <p style="margin:24px 0">
      <a href="${url}/pest-risk-result" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        View Full Report
      </a>
    </p>
  `);

  const text = [
    `Crop Alert: Action Needed`,
    '',
    `Hello ${name},`,
    '',
    `Risk Level: ${level.toUpperCase()}`,
    `Likely Issue: ${issue}`,
    confidence != null ? `Confidence: ${confidence}%` : null,
    '',
    `What to do now: ${whatToDo}`,
    `Where to inspect: ${whereToInspect}`,
    '',
    `View full report: ${url}/pest-risk-result`,
    '',
    '— The Farroway Team',
  ].filter(l => l !== null).join('\n');

  return { subject, html, text };
}
