/**
 * Avatar Storage — localStorage-backed avatar persistence.
 *
 * Stores a compressed data URL for the farmer's avatar photo.
 * Lightweight, immediate, survives page reloads.
 * Max ~50KB after compression (suitable for a small avatar).
 */

const STORAGE_KEY = 'farroway:avatar';
const MAX_SIZE = 200; // px — resize to this max dimension
const QUALITY = 0.7;  // JPEG quality

/** Get stored avatar data URL (or null) */
export function getAvatar() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Save avatar data URL */
export function saveAvatar(dataUrl) {
  try {
    localStorage.setItem(STORAGE_KEY, dataUrl);
  } catch { /* storage full — silently fail */ }
}

/** Remove avatar */
export function removeAvatar() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Compress and resize an image file to a small JPEG data URL.
 * Returns a Promise<string> (data URL) or null on failure.
 *
 * @param {File} file - Image file from input
 * @returns {Promise<string|null>}
 */
export function compressAvatar(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        // Calculate resize dimensions (fit within MAX_SIZE square)
        let w = img.width;
        let h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        // Draw to canvas and export as JPEG
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Center-crop to square
        const srcSize = Math.min(img.width, img.height);
        const sx = (img.width - srcSize) / 2;
        const sy = (img.height - srcSize) / 2;
        ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
