import { config } from '../config/index.js';

/**
 * Global error handler middleware.
 * Never exposes stack traces in production.
 */
export function errorHandler(err, req, res, _next) {
  // Log error server-side always
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (!config.isProduction) {
    console.error(err.stack);
  }

  // Prisma known-error handling
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Related record not found (foreign key constraint)' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size is ${config.upload.maxFileSizeMB}MB` });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && config.isProduction
    ? 'Internal server error'
    : err.message || 'Internal server error';

  // Never include stack traces in API responses — log them server-side only
  res.status(statusCode).json({ error: message });
}

/**
 * Async route wrapper — catches async errors and passes to error handler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
