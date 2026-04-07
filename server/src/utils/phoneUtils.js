/**
 * Server-side phone utilities.
 *
 * Design contract:
 *   - The frontend (PhoneInput component) normalizes the phone to E.164-like format
 *     before submission (e.g. "+254712345678").
 *   - The server's job is to: (a) do a final light normalization (strip whitespace /
 *     punctuation), and (b) validate the digit count is plausible.
 *   - Dial-code prepending is NOT done server-side — the frontend handles that.
 *     This keeps the server stateless with respect to country data.
 */

/**
 * Lightweight server-side normalization.
 * Strips surrounding whitespace and collates embedded spaces, dashes,
 * dots, and parentheses. Does NOT prepend a dial code.
 *
 * Examples:
 *   "+254 712 345 678"  → "+254712345678"
 *   " +44-20-7946-0958" → "+442079460958"
 *   "0712345678"        → "0712345678"  (returned as-is — no dial code here)
 *
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhoneForStorage(phone) {
  if (!phone) return phone;
  return phone.trim().replace(/[\s\-().]/g, '');
}

/**
 * Basic phone sanity check.
 * Accepts any number that has between 7 and 15 digits — covers local formats,
 * national formats, and full E.164 numbers. Does not enforce E.164 strictly
 * so plausible international numbers are never over-rejected.
 *
 * @param {string} phone  (should already be normalized)
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePhone(phone) {
  if (!phone || !phone.trim()) {
    return { valid: false, message: 'Phone number is required' };
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) {
    return { valid: false, message: 'Enter a valid phone number' };
  }
  if (digits.length > 15) {
    return { valid: false, message: 'Enter a valid phone number' };
  }
  return { valid: true };
}
