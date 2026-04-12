const DB_NAME = 'farm_app_offline_db';
const DB_VERSION = 1;
const PROFILE_STORE = 'profile_drafts';
const QUEUE_STORE = 'sync_queue';
const PREFS_STORE = 'user_prefs';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function get(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveProfileDraft(profile) {
  return put(PROFILE_STORE, { key: 'current_profile_draft', profile, updatedAt: Date.now() });
}

export async function getProfileDraft() {
  const record = await get(PROFILE_STORE, 'current_profile_draft');
  return record?.profile || null;
}

export async function enqueueProfileSync(payload) {
  return put(QUEUE_STORE, { id: `profile-${Date.now()}`, type: 'SAVE_PROFILE', payload, createdAt: Date.now() });
}

export async function getSyncQueue() {
  return getAll(QUEUE_STORE);
}

export async function removeSyncQueueItem(id) {
  return remove(QUEUE_STORE, id);
}

export async function savePreference(key, value) {
  return put(PREFS_STORE, { key, value });
}

export async function getPreference(key) {
  const record = await get(PREFS_STORE, key);
  return record?.value ?? null;
}
