/**
 * harvestAlertTemplate.js — harvest-readiness envelope.
 */

function _state(s) {
  const v = String(s || 'maturing').toLowerCase();
  return ['ready', 'soon', 'maturing', 'overdue'].includes(v) ? v : 'maturing';
}

export function harvestAlertTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const state = _state(c.state);
    const crop = c.crop ? String(c.crop) : '';
    const FALLBACK = {
      ready:    'Your {crop} may be ready to harvest — check the plants.',
      soon:     'Your {crop} should be ready to harvest soon.',
      maturing: 'Your {crop} is maturing — check progress.',
      overdue:  'Your {crop} is past the typical harvest window — check today.',
    };
    return {
      key: 'intelligence.harvest.' + state,
      fallback: FALLBACK[state],
      params: { crop, state },
    };
  } catch {
    return {
      key: 'intelligence.harvest.maturing',
      fallback: 'Check on your crop\'s progress.',
      params: {},
    };
  }
}

const _module = { harvestAlertTemplate };
export default _module;
