import { Track } from '../types/music';

const DB_NAME = 'hypeboom_audio_cache_v1';
const STORE_NAME = 'audio_blobs';
const DOWNLOADS_META_KEY = 'hypeboom_downloads_meta_v1';

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCachedAudioBlob(
  cacheKey: string,
  blob: Blob
): Promise<boolean> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, cacheKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadCachedAudioBlob(
  cacheKey: string
): Promise<Blob | null> {
  try {
    const db = await openAudioDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(cacheKey);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deleteCachedAudioBlob(cacheKey: string): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(cacheKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore deletion errors
  }
}

export function loadSavedDownloadMeta(): Track[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DOWNLOADS_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Track =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.cacheKey === 'string'
    );
  } catch {
    return [];
  }
}

export function saveDownloadMeta(tracks: Track[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serializable = tracks.map((t) => ({
      ...t,
      audioUrl: undefined,
    }));
    window.localStorage.setItem(
      DOWNLOADS_META_KEY,
      JSON.stringify(serializable)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function triggerDeviceDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
