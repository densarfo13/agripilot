/**
 * Centralized input validation utilities.
 */

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID string.
 */
export function isValidUUID(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

/**
 * Validate email format.
 */
export function isValidEmail(str) {
  if (typeof str !== 'string' || str.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/**
 * Password policy:
 * - Min 8 chars
 * - At least 1 uppercase, 1 lowercase, 1 digit
 * Returns { valid, message }
 */
export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one digit' };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Sanitize a filename — remove path traversal characters.
 */
export function sanitizeFilename(name) {
  if (typeof name !== 'string') return 'unnamed';
  // Remove path separators and null bytes
  return name.replace(/[/\\:\0]/g, '_').replace(/\.\./g, '_').trim() || 'unnamed';
}

/**
 * Validate and coerce a positive integer from query string.
 */
export function parsePositiveInt(value, defaultVal = 1, max = 10000) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) return defaultVal;
  return Math.min(parsed, max);
}

/**
 * Middleware factory: validate that req.params[param] is a valid UUID.
 */
export function validateParamUUID(param = 'id') {
  return (req, res, next) => {
    if (!isValidUUID(req.params[param])) {
      return res.status(400).json({ error: `Invalid ${param} format` });
    }
    next();
  };
}
