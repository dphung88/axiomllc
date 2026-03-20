// IndexedDB storage for video blobs — persists across page refreshes
const DB_NAME = 'EdisonStudioVideos';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
};

/** Save a video Blob to IndexedDB under the given key */
export const storeVideoBlob = async (key: string, blob: Blob): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('[VideoStorage] storeVideoBlob failed:', e);
  }
};

/**
 * Retrieve a video Blob from IndexedDB and return a fresh blob: URL.
 * Returns null if not found.
 */
export const getVideoBlob = async (key: string): Promise<string | null> => {
  try {
    const db = await openDB();
    return new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        const blob = req.result as Blob | undefined;
        resolve(blob ? URL.createObjectURL(blob) : null);
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch (e) {
    console.warn('[VideoStorage] getVideoBlob failed:', e);
    return null;
  }
};

/** Delete one video entry from IndexedDB */
export const deleteVideoBlob = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch (e) {
    console.warn('[VideoStorage] deleteVideoBlob failed:', e);
  }
};

/** Wipe all stored videos (called on reset) */
export const clearAllVideoBlobs = async (): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch (e) {
    console.warn('[VideoStorage] clearAllVideoBlobs failed:', e);
  }
};
