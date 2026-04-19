/**
 * LocationConfidenceHint — small inline hint that softens the
 * "detected X" copy when the location confidence is medium/low.
 * Designed to slot into the location step right below the
 * detected country / state display.
 */

import { locationConfidenceHintKey } from '../../utils/confidenceWording.js';

function resolve(t, { key, fallback }) {
  if (typeof t !== 'function') return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

export default function LocationConfidenceHint({ confidence, t = null }) {
  const { key, fallback } = locationConfidenceHintKey(confidence);
  const level = confidence?.level || 'medium';
  const tone  = level === 'high' ? '#1b5e20' : level === 'medium' ? '#616161' : '#c62828';

  return (
    <p
      className={`location-confidence-hint location-confidence-hint--${level}`}
      data-confidence-level={level}
      style={{ margin: '4px 0 0', fontSize: 13, color: tone }}
    >
      {resolve(t, { key, fallback })}
    </p>
  );
}
