/**
 * imageStore — IndexedDB-backed store for pest/crop images.
 *
 * Guarantees image data is persisted BEFORE upload attempt.
 * Images are only deleted after confirmed server receipt.
 *
 * Flow:
 *   1. User captures photo → saveImage() writes blob to IndexedDB
 *   2. Upload attempted → markUploading(id)
 *   3. Upload succeeds → removeImage(id) (only safe deletion path)
 *   4. Upload fails → image stays in IndexedDB for retry
 *   5. On reconnect → getPendingImages() returns all un-uploaded images
 *
 * Storage: IndexedDB 'farroway-images' / 'images' store
 * Blob data stored directly (IndexedDB supports Blob/ArrayBuffer natively).
 */

const DB_NAME = 'farroway-images';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let _dbPromise = null;

// Fix P3.9 — IndexedDB open wrapped in try/catch so private-mode
// browsers, quota-exceeded errors, and permission denials degrade
// gracefully instead of crashing the photo capture flow. When IDB
// is unavailable we expose a `_unavailable` sentinel; downstream
// reads/writes resolve with no-op semantics so the UI keeps
// working (image just isn't persisted).
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        console.warn('[imageStore] IndexedDB not available — running with no local persistence');
        resolve({ _unavailable: true });
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          }
        } catch (err) {
          console.warn('[imageStore] onupgradeneeded threw:', err && err.message);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[imageStore] open() error:',
          (req.error && req.error.message) || 'unknown');
        resolve({ _unavailable: true });
      };
      req.onblocked = () => {
        console.warn('[imageStore] open() blocked');
        resolve({ _unavailable: true });
      };
    } catch (err) {
      console.warn('[imageStore] openDB threw:', err && err.message);
      resolve({ _unavailable: true });
    }
  });
  return _dbPromise;
}

function tx(mode) {
  return openDB().then((db) => {
    if (db && db._unavailable) {
      // No persistence available — return a stub object store whose
      // ops resolve to no-op values so callers don't crash.
      return null;
    }
    try {
      const t = db.transaction(STORE_NAME, mode);
      return t.objectStore(STORE_NAME);
    } catch (err) {
      console.warn('[imageStore] tx() failed:', err && err.message);
      return null;
    }
  });
}

/** Upload status values */
export const IMAGE_STATUS = {
  PENDING: 'pending',       // Saved locally, not yet uploaded
  UPLOADING: 'uploading',   // Upload in progress
  UPLOADED: 'uploaded',     // Server confirmed — safe to remove
  FAILED: 'failed',         // Upload failed — retry on reconnect
};

/**
 * Save an image to IndexedDB before upload.
 *
 * @param {Object} opts
 * @param {Blob|File} opts.blob - Image data
 * @param {string} opts.farmId - Associated farm
 * @param {string} [opts.context] - e.g. 'pest_check', 'crop_photo', 'progress_update'
 * @param {string} [opts.fileName] - Original file name
 * @param {Object} [opts.metadata] - Extra data (pest type, notes, etc.)
 * @returns {Promise<number>} Record ID in IndexedDB
 */
export async function saveImage({ blob, farmId, context = 'pest_check', fileName = null, metadata = null }) {
  const store = await tx('readwrite');
  // B1 — IndexedDB unavailable (private mode / quota / blocked).
  // Return null so the caller can fall through to its in-memory
  // path; without this guard `store.add(...)` crashes the capture
  // flow on any browser where the P3.9 sentinel kicked in.
  if (!store) return null;
  return new Promise((resolve, reject) => {
    const req = store.add({
      blob,
      farmId,
      context,
      fileName: fileName || `image_${Date.now()}.jpg`,
      metadata: metadata || null,
      status: IMAGE_STATUS.PENDING,
      createdAt: Date.now(),
      lastAttemptAt: null,
      retryCount: 0,
      serverUrl: null, // Populated after successful upload
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all images with a given status.
 * @param {string} [status] - Filter by status. Omit for all images.
 * @returns {Promise<Array>}
 */
export async function getImages(status = null) {
  const store = await tx('readonly');
  // B1 — IndexedDB unavailable. Return an empty array so the UI
  // renders as if no images are queued (vs crashing at .getAll()).
  if (!store) return [];
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(status ? all.filter(img => img.status === status) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get images ready for upload (pending or failed) */
export async function getPendingImages() {
  const all = await getImages();
  return all.filter(img =>
    img.status === IMAGE_STATUS.PENDING || img.status === IMAGE_STATUS.FAILED
  );
}

/** Get a single image by ID */
export async function getImage(id) {
  const store = await tx('readonly');
  // B1 — graceful degrade when IDB unavailable.
  if (!store) return null;
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark an image as uploading (in-flight).
 * @param {number} id
 */
export async function markUploading(id) {
  const img = await getImage(id);
  if (!img) return;
  await _update({ ...img, status: IMAGE_STATUS.UPLOADING, lastAttemptAt: Date.now() });
}

/**
 * Mark an image as uploaded with the server URL.
 * @param {number} id
 * @param {string} serverUrl - URL returned by server after upload
 */
export async function markUploaded(id, serverUrl) {
  const img = await getImage(id);
  if (!img) return;
  await _update({ ...img, status: IMAGE_STATUS.UPLOADED, serverUrl });
}

/**
 * Mark an image upload as failed (for retry).
 * @param {number} id
 */
export async function markFailed(id) {
  const img = await getImage(id);
  if (!img) return;
  await _update({
    ...img,
    status: IMAGE_STATUS.FAILED,
    retryCount: (img.retryCount || 0) + 1,
    lastAttemptAt: Date.now(),
  });
}

/**
 * Remove an image from IndexedDB.
 * ONLY call this after server confirms receipt (status === UPLOADED).
 *
 * @param {number} id
 */
export async function removeImage(id) {
  const store = await tx('readwrite');
  // B1 — graceful degrade when IDB unavailable.
  if (!store) return;
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove all uploaded images (cleanup after confirmed sync).
 * @returns {Promise<number>} Count of removed images
 */
export async function cleanupUploaded() {
  const uploaded = await getImages(IMAGE_STATUS.UPLOADED);
  let removed = 0;
  for (const img of uploaded) {
    await removeImage(img.id);
    removed++;
  }
  return removed;
}

/** Count of images pending upload */
export async function pendingCount() {
  const pending = await getPendingImages();
  return pending.length;
}

/** Internal: update an image record in-place */
async function _update(record) {
  try {
    const store = await tx('readwrite');
    // B1 — graceful degrade when IDB unavailable. _update is
    // best-effort, so silently no-op rather than crash the
    // status-transition callers (markUploading/Uploaded/Failed).
    if (!store) return;
    return new Promise((resolve) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best-effort
    });
  } catch { /* best-effort */ }
}
