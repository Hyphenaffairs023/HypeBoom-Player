import { FolderEntry } from '../types/music';

const DB_NAME = 'koto_storage_db';
const STORE_NAME = 'handles';
const ROOT_KEY = 'music_root_dir';

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i;
const LRC_EXT_RE = /\.lrc$/i;

export function isAudioFilename(name: string): boolean {
  return AUDIO_EXT_RE.test(name);
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openHandleDb(): Promise<IDBDatabase> {
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

export async function saveRootDirHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, ROOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore persistence failures
  }
}

export async function loadRootDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(ROOT_KEY);
        req.onsuccess = () =>
          resolve((req.result as FileSystemDirectoryHandle) ?? null);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearRootDirHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ROOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export async function readHandleDirectory(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string[]
): Promise<FolderEntry[]> {
  const dirs: FolderEntry[] = [];
  const audioHandles: Array<{
    name: string;
    handle: FileSystemFileHandle;
  }> = [];
  const lrcMap = new Map<string, FileSystemFileHandle>();

  const entries = (
    dirHandle as unknown as {
      values: () => AsyncIterable<FileSystemHandle>;
    }
  ).values();

  for await (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.kind === 'directory') {
      dirs.push({
        kind: 'directory',
        name: entry.name,
        path: [...basePath, entry.name],
        dirHandle: entry as FileSystemDirectoryHandle,
      });
    } else if (entry.kind === 'file') {
      const fh = entry as FileSystemFileHandle;
      if (isAudioFilename(entry.name)) {
        audioHandles.push({ name: entry.name, handle: fh });
      } else if (LRC_EXT_RE.test(entry.name)) {
        lrcMap.set(stripExtension(entry.name).toLowerCase(), fh);
      }
    }
  }

  const files: FolderEntry[] = await Promise.all(
    audioHandles.map(async ({ name, handle }) => {
      let size: number | undefined;
      try {
        const f = await handle.getFile();
        size = f.size;
      } catch {
        // Ignore size probe errors
      }
      return {
        kind: 'file' as const,
        name,
        path: [...basePath, name],
        size,
        fileHandle: handle,
        lrcFileHandle: lrcMap.get(stripExtension(name).toLowerCase()),
      };
    })
  );

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export interface VirtualDirNode {
  name: string;
  subdirs: Map<string, VirtualDirNode>;
  files: File[];
  lrcFiles: Map<string, File>;
}

export function buildVirtualTree(fileList: FileList | File[]): {
  rootName: string;
  root: VirtualDirNode;
} {
  const files = Array.from(fileList);
  const firstRel =
    (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ||
    '';
  const rootName = firstRel.split('/')[0] || 'Local Folder';

  const root: VirtualDirNode = {
    name: rootName,
    subdirs: new Map(),
    files: [],
    lrcFiles: new Map(),
  };

  for (const file of files) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const parts = rel.split('/').filter(Boolean);
    // Strip rootName prefix if present
    const innerParts = parts.length > 1 ? parts.slice(1) : parts;
    const fileName = innerParts[innerParts.length - 1];
    if (!fileName || fileName.startsWith('.')) continue;

    let current = root;
    for (let i = 0; i < innerParts.length - 1; i++) {
      const seg = innerParts[i];
      let child = current.subdirs.get(seg);
      if (!child) {
        child = {
          name: seg,
          subdirs: new Map(),
          files: [],
          lrcFiles: new Map(),
        };
        current.subdirs.set(seg, child);
      }
      current = child;
    }

    if (isAudioFilename(fileName)) {
      current.files.push(file);
    } else if (LRC_EXT_RE.test(fileName)) {
      current.lrcFiles.set(stripExtension(fileName).toLowerCase(), file);
    }
  }

  return { rootName, root };
}

export function readVirtualDirectory(
  root: VirtualDirNode,
  subPath: string[]
): FolderEntry[] {
  let node: VirtualDirNode | undefined = root;
  for (const seg of subPath) {
    node = node?.subdirs.get(seg);
    if (!node) return [];
  }

  const dirs: FolderEntry[] = Array.from(node.subdirs.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((dir) => ({
      kind: 'directory',
      name: dir.name,
      path: [...subPath, dir.name],
    }));

  const files: FolderEntry[] = [...node.files]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => ({
      kind: 'file',
      name: file.name,
      path: [...subPath, file.name],
      size: file.size,
      file,
      lrcFile: node.lrcFiles.get(stripExtension(file.name).toLowerCase()),
    }));

  return [...dirs, ...files];
}
