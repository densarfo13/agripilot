/**
 * Client-side image compression using Canvas API.
 *
 * Resizes large images before upload to reduce bandwidth on mobile/slow networks.
 * Preserves aspect ratio. Falls back to original file if compression fails.
 *
 * Usage:
 *   const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
 *   // compressed is a File object ready for FormData
 */

const DEFAULTS = {
  maxWidth: 1200,   // max pixel width (height scales proportionally)
  maxHeight: 1200,  // max pixel height
  quality: 0.82,    // JPEG quality (0-1)
  type: 'image/jpeg', // output MIME type
};

/**
 * Compress an image File using canvas.
 * @param {File} file — original image file
 * @param {Object} opts — { maxWidth, maxHeight, quality, type }
 * @returns {Promise<File>} — compressed File, or original if compression fails or isn't needed
 */
export async function compressImage(file, opts = {}) {
  const { maxWidth, maxHeight, quality, type } = { ...DEFAULTS, ...opts };

  // Only compress image types
  if (!file || !file.type.startsWith('image/')) return file;

  // Skip small files (under 200KB) — compression won't help much
  if (file.size < 200 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width: origW, height: origH } = bitmap;

    // Calculate target dimensions preserving aspect ratio
    let w = origW;
    let h = origH;
    if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
    if (h > maxHeight) { w = Math.round(w * (maxHeight / h)); h = maxHeight; }

    // Skip if no resize needed and file is already small
    if (w === origW && h === origH && file.size < 500 * 1024) {
      bitmap.close();
      return file;
    }

    // Draw to canvas
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    // Convert to blob
    const blob = await canvas.convertToBlob({ type, quality });

    // Only use compressed version if it's actually smaller
    if (blob.size >= file.size) return file;

    // Create a new File with the original name
    const ext = type === 'image/jpeg' ? '.jpg' : type === 'image/png' ? '.png' : '.webp';
    const name = file.name.replace(/\.[^.]+$/, ext);
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    // Canvas/OffscreenCanvas not supported or error — return original
    return file;
  }
}

/**
 * Get human-readable file size.
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
