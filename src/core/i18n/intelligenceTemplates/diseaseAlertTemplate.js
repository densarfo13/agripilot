/**
 * diseaseAlertTemplate.js — hedged disease-alert envelope.
 * Wording rule: "possible / may / monitor — never confirmed".
 */

function _sev(s) {
  const v = String(s || '').toLowerCase();
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium';
}

export function diseaseAlertTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const severity = _sev(c.severity);
    const crop = c.crop ? String(c.crop) : '';
    const issue = c.issue ? String(c.issue) : '';
    // Severity-tiered keys so the surface can render distinct copy
    // per band without the template caring about wording.
    return {
      key: 'intelligence.disease.' + severity,
      fallback: severity === 'high'
        ? 'Possible disease signs on your {crop} — please check today.'
        : severity === 'medium'
          ? 'Watch your {crop} — early signs may indicate disease.'
          : 'Monitor your {crop} — no urgent risk seen.',
      params: { crop, issue, severity },
    };
  } catch {
    return {
      key: 'intelligence.disease.medium',
      fallback: 'Watch your crop — early signs may indicate disease.',
      params: {},
    };
  }
}

const _module = { diseaseAlertTemplate };
export default _module;
