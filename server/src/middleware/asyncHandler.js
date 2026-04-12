/**
 * Wraps an async Express route handler to catch errors and forward to next().
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
