import fs from 'fs';
import { logUploadEvent } from '../utils/opsLogger.js';

/**
 * Upload Cleanup Middleware
 *
 * Multer writes files to disk BEFORE the route handler executes.
 * If the handler throws (validation error, DB error, etc.), the file remains
 * orphaned on disk with no DB record pointing to it.
 *
 * This middleware intercepts the response and deletes the uploaded file
 * if the route handler produces an error response (4xx/5xx).
 *
 * Must be applied AFTER multer middleware but BEFORE the route handler.
 */
export function uploadCleanup(req, res, next) {
  // Hook into response finish to check if we should clean up
  const originalEnd = res.end;

  res.end = function (...args) {
    // If response is an error AND a file was uploaded, clean up the orphan
    if (res.statusCode >= 400 && req.file?.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          logUploadEvent('orphan_cleaned', { file: req.file.path, status: res.statusCode });
        }
      } catch (err) {
        logUploadEvent('cleanup_failed', { file: req.file.path, error: err.message });
      }
    }

    // Also clean up if multiple files were uploaded (multer .array())
    if (res.statusCode >= 400 && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            logUploadEvent('orphan_cleaned', { file: file.path, status: res.statusCode });
          }
        } catch (err) {
          logUploadEvent('cleanup_failed', { file: file.path, error: err.message });
        }
      }
    }

    return originalEnd.apply(this, args);
  };

  next();
}
