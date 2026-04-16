/**
 * Client-side image compression using Canvas API.
 *
 * Resizes large images before upload to reduce bandwidth on mobile/slow networks.
 * Preserves aspect ratio. Falls back to original file if compression fails.
 *
 * Performance:
 *   - Files >1MB are compressed in a Web Worker (non-blocking UI)
 *   - Smaller files use main-thread OffscreenCanvas (fast enough)
 *   - Falls back to main-thread if Worker unavailable
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

// Threshold for offloading to Web Worker (1MB+)
const WORKER_THRESHOLD = 1024 * 1024;

/**
 * Compress an image File using canvas.
 * For large files (>1MB), offloads to Web Worker to keep UI responsive.
 *
 * @param {File} file — original image file
 * @param {Object} opts — { maxWidth, maxHeight, quality, type }
 * @returns {Promise<File>} — compressed File, or original if compression fails or isn't needed
 */
export async function compressImage(file, opts = {}) {
  // Only compress image types
  if (!file || !file.type.startsWith('image/')) return file;

  // Skip small files (under 200KB) — compression won't help much
  if (file.size < 200 * 1024) return file;

  // Large files: try Web Worker to avoid blocking UI
  if (file.size > WORKER_THRESHOLD) {
    try {
      const result = await compressInWorker(file, opts);
      if (result) return result;
    } catch {
      // Worker failed — fall through to main thread
    }
  }

  return _compressMainThread(file, opts);
}

/**
 * Main-thread compression (original implementation).
 */
async function _compressMainThread(file, opts = {}) {
  const { maxWidth, maxHeight, quality, type } = { ...DEFAULTS, ...opts };

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
 * Compress an image in a Web Worker (non-blocking).
 * Uses an inline worker via Blob URL — no separate worker file needed.
 *
 * @param {File} file
 * @param {Object} opts
 * @returns {Promise<File|null>} — compressed file, or null if worker unavailable
 */
export function compressInWorker(file, opts = {}) {
  if (typeof Worker === 'undefined') return Promise.resolve(null);

  const { maxWidth, maxHeight, quality, type } = { ...DEFAULTS, ...opts };

  return new Promise((resolve) => {
    // Inline worker source — self-contained compression logic
    const workerCode = `
      self.onmessage = async function(e) {
        const { buffer, maxWidth, maxHeight, quality, type, origSize, fileName } = e.data;
        try {
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const bitmap = await createImageBitmap(blob);
          let w = bitmap.width;
          let h = bitmap.height;
          if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
          if (h > maxHeight) { w = Math.round(w * (maxHeight / h)); h = maxHeight; }

          if (w === bitmap.width && h === bitmap.height && origSize < 500 * 1024) {
            bitmap.close();
            self.postMessage({ skip: true });
            return;
          }

          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();

          const result = await canvas.convertToBlob({ type, quality });
          if (result.size >= origSize) {
            self.postMessage({ skip: true });
            return;
          }

          const arrBuf = await result.arrayBuffer();
          self.postMessage({ buffer: arrBuf, type, fileName }, [arrBuf]);
        } catch {
          self.postMessage({ error: true });
        }
      };
    `;

    let worker;
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
      URL.revokeObjectURL(url);
    } catch {
      resolve(null);
      return;
    }

    // Timeout: if worker takes >15s, fall back to main thread
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve(null);
    }, 15000);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();

      if (e.data.error || e.data.skip) {
        resolve(e.data.skip ? file : null);
        return;
      }

      const ext = type === 'image/jpeg' ? '.jpg' : type === 'image/png' ? '.png' : '.webp';
      const name = file.name.replace(/\.[^.]+$/, ext);
      const compressed = new File([e.data.buffer], name, { type: e.data.type, lastModified: Date.now() });
      resolve(compressed);
    };

    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(null);
    };

    // Transfer the file buffer to the worker (zero-copy)
    file.arrayBuffer().then((buffer) => {
      worker.postMessage(
        { buffer, maxWidth, maxHeight, quality, type, origSize: file.size, fileName: file.name },
        [buffer],
      );
    }).catch(() => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(null);
    });
  });
}

/**
 * Get human-readable file size.
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
