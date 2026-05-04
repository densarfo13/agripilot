/**
 * getDisplayText.js — safe object → string helper.
 *
 *   import { getDisplayText } from './lib/getDisplayText.js';
 *
 *   <div>{getDisplayText(farm.crop, 'No crop selected')}</div>
 *
 * Why this exists
 *   Rendering an object directly in JSX (`{farm.crop}`) throws
 *   when crop is `{ name: 'tomato' }` instead of a plain string.
 *   This helper resolves objects to their best-effort display
 *   field without crashing.
 *
 * Resolution order for objects:
 *   value.name → value.label → value.title → fallback
 *
 * Strict-rule audit
 *   • Pure; never throws.
 *   • Never returns `undefined` — always a string.
 *   • Never coerces a raw object to "[object Object]" — that
 *     was the previous footgun every component had to remember
 *     to defend against.
 */

export function getDisplayText(value, fallback = '') {
  if (value == null) return String(fallback);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (typeof value.name  === 'string' && value.name.length  > 0) return value.name;
    if (typeof value.label === 'string' && value.label.length > 0) return value.label;
    if (typeof value.title === 'string' && value.title.length > 0) return value.title;
    return String(fallback);
  }
  return String(fallback);
}

export default getDisplayText;
