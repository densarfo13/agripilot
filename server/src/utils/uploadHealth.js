import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Upload Health Utilities
 *
 * Provides operational tooling for file/image lifecycle management:
 * - Upload directory health checks
 * - Orphan file detection
 * - Disk usage summary
 *
 * Not a full media platform — practical health checks for pilot/limited-scale use.
 */

/**
 * Get the resolved uploads directory path.
 */
export function getUploadsDir() {
  return path.resolve(config.upload.dir);
}

/**
 * Check upload directory health.
 * Returns: { exists, writable, fileCount, totalSizeBytes, totalSizeMB }
 */
export function checkUploadDirHealth() {
  const dir = getUploadsDir();
  const result = {
    directory: dir,
    exists: false,
    writable: false,
    fileCount: 0,
    totalSizeBytes: 0,
    totalSizeMB: 0,
    maxFileSizeMB: config.upload.maxFileSizeMB,
  };

  try {
    result.exists = fs.existsSync(dir);
    if (!result.exists) return result;

    // Check writable by attempting to create and remove a temp file
    const testFile = path.join(dir, `.health-check-${Date.now()}`);
    try {
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
      result.writable = true;
    } catch {
      result.writable = false;
    }

    // Count files and compute total size
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('.')) continue; // skip hidden/temp files
      try {
        const stat = fs.statSync(path.join(dir, file));
        if (stat.isFile()) {
          result.fileCount++;
          result.totalSizeBytes += stat.size;
        }
      } catch { /* skip unreadable files */ }
    }

    result.totalSizeMB = Math.round((result.totalSizeBytes / (1024 * 1024)) * 100) / 100;
  } catch (err) {
    console.warn(`[UPLOAD_HEALTH] Error checking upload directory: ${err.message}`);
  }

  return result;
}

/**
 * List files on disk in the uploads directory.
 * Returns array of { filename, sizeBytes, modifiedAt }.
 */
export function listDiskFiles() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) return [];

  const files = [];
  try {
    for (const file of fs.readdirSync(dir)) {
      if (file.startsWith('.')) continue;
      try {
        const stat = fs.statSync(path.join(dir, file));
        if (stat.isFile()) {
          files.push({
            filename: file,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime,
          });
        }
      } catch { /* skip */ }
    }
  } catch { /* dir read failed */ }
  return files;
}

/**
 * Detect orphaned files: files on disk with no matching DB record.
 * Requires a function that checks if a filename exists in the DB.
 *
 * @param {Function} dbFilenameChecker - async (filename) => boolean
 * @returns {Array} List of orphaned filenames
 */
export async function detectOrphanedFiles(dbFilenameChecker) {
  const diskFiles = listDiskFiles();
  const orphans = [];

  for (const file of diskFiles) {
    const existsInDb = await dbFilenameChecker(file.filename);
    if (!existsInDb) {
      orphans.push(file);
    }
  }

  return orphans;
}

/**
 * Remove a specific file from the uploads directory.
 * Returns true if removed, false if not found or failed.
 */
export function removeUploadFile(filename) {
  // Safety: prevent directory traversal
  const safeName = path.basename(filename);
  const filePath = path.join(getUploadsDir(), safeName);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.warn(`[UPLOAD_HEALTH] Failed to remove ${safeName}: ${err.message}`);
  }
  return false;
}

/**
 * Validate that a file reference is safe (no directory traversal, proper format).
 */
export function isValidFileReference(url) {
  if (!url || typeof url !== 'string') return false;
  // Must not contain directory traversal
  if (url.includes('..') || url.includes('\0')) return false;
  // If it's a relative /uploads/ path, validate the pattern
  if (url.startsWith('/uploads/')) {
    const filename = url.replace('/uploads/', '');
    // Must be a simple filename (no slashes)
    return !filename.includes('/') && !filename.includes('\\') && filename.length > 0;
  }
  // External URLs are allowed (http/https) for progress images
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
}
