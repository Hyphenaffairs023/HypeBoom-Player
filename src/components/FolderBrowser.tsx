import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderSync,
  ListPlus,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Unplug,
} from 'lucide-react';
import { FolderEntry } from '../types/music';
import {
  buildVirtualTree,
  clearRootDirHandle,
  formatFileSize,
  loadRootDirHandle,
  readHandleDirectory,
  readVirtualDirectory,
  saveRootDirHandle,
  VirtualDirNode,
} from '../utils/folderBrowser';

export interface LocalAudioPayload {
  file: File;
  lyricsText?: string;
  albumName?: string;
}

interface FolderBrowserProps {
  onPlayLocalItems: (items: LocalAudioPayload[]) => void;
  onQueueLocalItems: (items: LocalAudioPayload[]) => void;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<FileSystemDirectoryHandle>;
}

interface PermissionCapableHandle extends FileSystemDirectoryHandle {
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface HandleBreadcrumb {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export function FolderBrowser({
  onPlayLocalItems,
  onQueueLocalItems,
}: FolderBrowserProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingDir, setIsLoadingDir] = useState(false);
  const [pendingHandle, setPendingHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [handleStack, setHandleStack] = useState<HandleBreadcrumb[]>([]);
  const [virtualRoot, setVirtualRoot] = useState<{
    rootName: string;
    root: VirtualDirNode;
  } | null>(null);
  const [virtualPath, setVirtualPath] = useState<string[]>([]);
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [folderQuery, setFolderQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Set webkitdirectory attribute cleanly without non-standard JSX prop warnings
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  // Auto-clear transient feedback
  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = window.setTimeout(() => setFeedbackMsg(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedbackMsg]);

  const loadHandleIntoState = useCallback(
    async (
      rootHandle: FileSystemDirectoryHandle,
      stackOverride?: HandleBreadcrumb[]
    ) => {
      setIsLoadingDir(true);
      setErrorMsg(null);
      try {
        const stack = stackOverride ?? [{ name: rootHandle.name, handle: rootHandle }];
        const current = stack[stack.length - 1];
        const pathSegments = stack.slice(1).map((s) => s.name);
        const list = await readHandleDirectory(current.handle, pathSegments);
        setVirtualRoot(null);
        setVirtualPath([]);
        setPendingHandle(null);
        setHandleStack(stack);
        setEntries(list);
        setFolderQuery('');
      } catch {
        setErrorMsg('Could not read this folder. Permission may have changed.');
      } finally {
        setIsLoadingDir(false);
      }
    },
    []
  );

  // Restore saved root folder handle on mount
  useEffect(() => {
    let active = true;
    loadRootDirHandle()
      .then(async (saved) => {
        if (!active || !saved) {
          if (active) setIsInitializing(false);
          return;
        }
        const permHandle = saved as PermissionCapableHandle;
        let state: PermissionState = 'prompt';
        try {
          if (typeof permHandle.queryPermission === 'function') {
            state = await permHandle.queryPermission({ mode: 'read' });
          } else {
            state = 'granted';
          }
        } catch {
          state = 'prompt';
        }

        if (!active) return;

        if (state === 'granted') {
          await loadHandleIntoState(saved);
        } else {
          setPendingHandle(saved);
        }
        if (active) setIsInitializing(false);
      })
      .catch(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
    };
  }, [loadHandleIntoState]);

  const handleReconnectPending = async () => {
    if (!pendingHandle) return;
    setErrorMsg(null);
    const permHandle = pendingHandle as PermissionCapableHandle;
    try {
      const result =
        typeof permHandle.requestPermission === 'function'
          ? await permHandle.requestPermission({ mode: 'read' })
          : 'granted';
      if (result === 'granted') {
        await loadHandleIntoState(pendingHandle);
      } else {
        setErrorMsg('Read permission was declined for this folder.');
      }
    } catch {
      setErrorMsg('Permission prompt was blocked. Please re-select the folder.');
    }
  };

  const handlePickRootFolder = async () => {
    setErrorMsg(null);
    const pickerWin = window as DirectoryPickerWindow;

    if (typeof pickerWin.showDirectoryPicker === 'function') {
      try {
        const handle = await pickerWin.showDirectoryPicker({
          id: 'koto-music-root',
          mode: 'read',
          startIn: 'music',
        });
        await saveRootDirHandle(handle);
        await loadHandleIntoState(handle);
        return;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'AbortError') {
          return;
        }
        // SecurityError / NotAllowedError in cross-origin iframes or unsupported options -> fallback below
      }
    }

    folderInputRef.current?.click();
  };

  const handleFallbackDirectoryChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    const tree = buildVirtualTree(files);
    clearRootDirHandle().catch(() => {});
    setPendingHandle(null);
    setHandleStack([]);
    setVirtualRoot(tree);
    setVirtualPath([]);
    setEntries(readVirtualDirectory(tree.root, []));
    setFolderQuery('');
  };

  const handleDisconnectFolder = async () => {
    await clearRootDirHandle();
    setPendingHandle(null);
    setHandleStack([]);
    setVirtualRoot(null);
    setVirtualPath([]);
    setEntries([]);
    setFolderQuery('');
    setErrorMsg(null);
  };

  const openSubdirectory = async (entry: FolderEntry) => {
    if (entry.kind !== 'directory') return;

    if (handleStack.length > 0 && entry.dirHandle) {
      const nextStack = [
        ...handleStack,
        { name: entry.name, handle: entry.dirHandle },
      ];
      await loadHandleIntoState(handleStack[0].handle, nextStack);
      return;
    }

    if (virtualRoot) {
      const nextPath = [...virtualPath, entry.name];
      setVirtualPath(nextPath);
      setEntries(readVirtualDirectory(virtualRoot.root, nextPath));
      setFolderQuery('');
    }
  };

  const navigateBreadcrumb = async (index: number) => {
    if (handleStack.length > 0) {
      const targetStack = handleStack.slice(0, index + 1);
      await loadHandleIntoState(handleStack[0].handle, targetStack);
      return;
    }

    if (virtualRoot) {
      const nextPath = virtualPath.slice(0, index);
      setVirtualPath(nextPath);
      setEntries(readVirtualDirectory(virtualRoot.root, nextPath));
      setFolderQuery('');
    }
  };

  const navigateUp = async () => {
    if (handleStack.length > 1) {
      await navigateBreadcrumb(handleStack.length - 2);
    } else if (virtualRoot && virtualPath.length > 0) {
      await navigateBreadcrumb(virtualPath.length - 1);
    }
  };

  const refreshCurrentDir = async () => {
    if (handleStack.length > 0) {
      await loadHandleIntoState(handleStack[0].handle, handleStack);
    }
  };

  const currentFolderName = useMemo(() => {
    if (handleStack.length > 0) {
      return handleStack[handleStack.length - 1].name;
    }
    if (virtualRoot) {
      return virtualPath.length > 0
        ? virtualPath[virtualPath.length - 1]
        : virtualRoot.rootName;
    }
    return 'Local Folder';
  }, [handleStack, virtualRoot, virtualPath]);

  const readPayloadForEntry = async (
    entry: FolderEntry
  ): Promise<LocalAudioPayload | null> => {
    try {
      const file =
        entry.file ??
        (entry.fileHandle ? await entry.fileHandle.getFile() : null);
      if (!file) return null;

      let lyricsText: string | undefined;
      try {
        const lrcFile =
          entry.lrcFile ??
          (entry.lrcFileHandle ? await entry.lrcFileHandle.getFile() : null);
        if (lrcFile) {
          lyricsText = await lrcFile.text();
        }
      } catch {
        // Ignore unreadable .lrc sidecar
      }

      return {
        file,
        lyricsText,
        albumName: currentFolderName,
      };
    } catch {
      setErrorMsg(`Unable to read "${entry.name}".`);
      return null;
    }
  };

  const handlePlayFile = async (entry: FolderEntry) => {
    const payload = await readPayloadForEntry(entry);
    if (!payload) return;
    onPlayLocalItems([payload]);
    setFeedbackMsg(`Playing ${entry.name}`);
  };

  const handleQueueFile = async (entry: FolderEntry) => {
    const payload = await readPayloadForEntry(entry);
    if (!payload) return;
    onQueueLocalItems([payload]);
    setFeedbackMsg(`Added "${entry.name}" to queue`);
  };

  const handleQueueCurrentFolder = async () => {
    const audioEntries = filteredEntries.filter((e) => e.kind === 'file');
    if (audioEntries.length === 0) return;

    const payloads = (
      await Promise.all(audioEntries.map((e) => readPayloadForEntry(e)))
    ).filter((item): item is LocalAudioPayload => item !== null);

    if (payloads.length > 0) {
      onQueueLocalItems(payloads);
      setFeedbackMsg(
        `Queued ${payloads.length} track${payloads.length === 1 ? '' : 's'} from ${currentFolderName}`
      );
    }
  };

  const filteredEntries = useMemo(() => {
    const q = folderQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, folderQuery]);

  const folderCount = filteredEntries.filter((e) => e.kind === 'directory').length;
  const audioFileCount = filteredEntries.filter((e) => e.kind === 'file').length;
  const hasConnectedRoot = handleStack.length > 0 || virtualRoot !== null;
  const isAtRoot =
    (handleStack.length > 0 && handleStack.length === 1) ||
    (virtualRoot !== null && virtualPath.length === 0);

  const breadcrumbs: string[] =
    handleStack.length > 0
      ? handleStack.map((s) => s.name)
      : virtualRoot
        ? [virtualRoot.rootName, ...virtualPath]
        : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Hidden directory picker fallback for iframes / Safari / Firefox */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={(e) => {
          handleFallbackDirectoryChange(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {isInitializing ? (
        <div className="flex-1 flex items-center justify-center p-8 text-xs text-[var(--th-text-muted)]">
          Checking saved folder permission...
        </div>
      ) : !hasConnectedRoot && pendingHandle ? (
        /* Saved Handle Needs Re-authorization Prompt */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--th-accent-soft)] text-[var(--th-accent-text)] flex items-center justify-center mb-4">
            <FolderSync className="w-6 h-6" strokeWidth={1.8} />
          </div>
          <h3 className="font-display text-base font-semibold text-[var(--th-text)]">
            Reconnect "{pendingHandle.name}"
          </h3>
          <p className="mt-1.5 text-xs text-[var(--th-text-muted)] max-w-xs leading-relaxed">
            Your browser remembered your root music folder. Confirm read access once for this session to browse subfolders and tracks.
          </p>

          {errorMsg ? (
            <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleReconnectPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Grant Access
            </button>
            <button
              type="button"
              onClick={handlePickRootFolder}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] text-[var(--th-text)] border border-[var(--th-border)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap shrink-0"
            >
              Choose Different Folder
            </button>
          </div>
        </div>
      ) : !hasConnectedRoot ? (
        /* First-Time Root Folder Connection */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text-muted)] flex items-center justify-center mb-4">
            <FolderOpen className="w-6 h-6" strokeWidth={1.7} />
          </div>
          <h3 className="font-display text-base font-semibold text-[var(--th-text)]">
            Browse Local Storage
          </h3>
          <p className="mt-1.5 text-xs text-[var(--th-text-muted)] max-w-xs leading-relaxed">
            Select a root music folder once to navigate nested artist or album folders, play audio directly, and auto-load matching .lrc lyrics.
          </p>

          {errorMsg ? (
            <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
          ) : null}

          <button
            type="button"
            onClick={handlePickRootFolder}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
          >
            <FolderOpen className="w-4 h-4" />
            Select Root Folder
          </button>
        </div>
      ) : (
        /* Connected Folder Navigator */
        <>
          {/* Breadcrumbs + Folder Controls */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--th-border)] flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
                {!isAtRoot ? (
                  <button
                    type="button"
                    onClick={navigateUp}
                    aria-label="Up one folder"
                    title="Up one folder"
                    className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                {breadcrumbs.map((segment, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <div
                      key={`${segment}-${idx}`}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {idx > 0 ? (
                        <ChevronRight
                          className="w-3.5 h-3.5 text-[var(--th-text-muted)] shrink-0"
                          aria-hidden="true"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => navigateBreadcrumb(idx)}
                        disabled={isLast}
                        className={`px-1.5 py-0.5 rounded text-xs truncate max-w-[140px] transition-colors ${
                          isLast
                            ? 'font-semibold text-[var(--th-text)] cursor-default'
                            : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
                        }`}
                      >
                        {segment}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {handleStack.length > 0 ? (
                  <button
                    type="button"
                    onClick={refreshCurrentDir}
                    aria-label="Refresh folder"
                    title="Refresh folder"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingDir ? 'animate-spin' : ''}`}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handlePickRootFolder}
                  title="Change root folder"
                  className="px-2 py-1 rounded-md text-xs font-medium text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectFolder}
                  aria-label="Disconnect folder"
                  title="Disconnect folder"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--th-text-muted)] hover:text-red-500 hover:bg-[var(--th-surface-hover)] transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter & Queue Folder Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-3.5 h-3.5 text-[var(--th-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.8}
                />
                <input
                  type="search"
                  value={folderQuery}
                  onChange={(e) => setFolderQuery(e.target.value)}
                  placeholder={`Search in ${currentFolderName}`}
                  aria-label="Filter folder contents"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--th-surface-alt)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] border border-[var(--th-border)] focus:outline-none focus:border-[var(--th-accent)] transition-colors"
                />
              </div>

              {audioFileCount > 0 ? (
                <button
                  type="button"
                  onClick={handleQueueCurrentFolder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] text-[var(--th-text)] border border-[var(--th-border)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap shrink-0"
                >
                  <ListPlus className="w-3.5 h-3.5 text-[var(--th-accent-text)]" />
                  Queue Folder
                </button>
              ) : null}
            </div>
          </div>

          {/* Directory Listing */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--th-border)] max-h-[420px] lg:max-h-[450px]">
            {errorMsg ? (
              <div className="px-5 py-3 text-xs text-red-500 bg-red-500/5">
                {errorMsg}
              </div>
            ) : null}

            {isLoadingDir ? (
              <div className="py-12 px-6 text-center text-xs text-[var(--th-text-muted)]">
                Scanning folder contents...
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <p className="text-sm font-medium text-[var(--th-text)]">
                  {folderQuery
                    ? 'No matching folders or audio files'
                    : 'No subfolders or audio files here'}
                </p>
                <p className="mt-1 text-xs text-[var(--th-text-muted)]">
                  {folderQuery
                    ? 'Try clearing the folder filter.'
                    : 'Supports MP3, WAV, FLAC, M4A, OGG, and AAC.'}
                </p>
              </div>
            ) : (
              filteredEntries.map((entry) => {
                if (entry.kind === 'directory') {
                  return (
                    <button
                      key={`dir-${entry.path.join('/')}`}
                      type="button"
                      onClick={() => openSubdirectory(entry)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[var(--th-surface-hover)] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--th-accent)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] flex items-center justify-center text-[var(--th-accent-text)] shrink-0">
                          <Folder className="w-4 h-4" strokeWidth={1.8} />
                        </div>
                        <span className="text-sm font-medium text-[var(--th-text)] truncate">
                          {entry.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--th-text-muted)] group-hover:text-[var(--th-text)] shrink-0 transition-colors" />
                    </button>
                  );
                }

                const hasLrc = Boolean(entry.lrcFile || entry.lrcFileHandle);
                const sizeText = formatFileSize(entry.size);

                return (
                  <div
                    key={`file-${entry.path.join('/')}`}
                    className="group flex items-center gap-3 px-5 py-2.5 hover:bg-[var(--th-surface-hover)] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handlePlayFile(entry)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] flex items-center justify-center text-[var(--th-text-muted)] group-hover:text-[var(--th-accent-text)] shrink-0 transition-colors">
                        <Music2 className="w-3.5 h-3.5 group-hover:hidden" />
                        <Play className="w-3.5 h-3.5 hidden group-hover:block fill-current text-[var(--th-accent-text)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--th-text)] truncate">
                          {entry.name}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[var(--th-text-muted)] mt-0.5 truncate">
                          {sizeText || 'Audio'}
                          {hasLrc ? ' · LRC lyrics' : ''}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQueueFile(entry)}
                      aria-label={`Add ${entry.name} to queue`}
                      title="Add to queue"
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-accent-text)] hover:bg-[var(--th-surface-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Folder Footer */}
          <div className="px-5 py-3 bg-[var(--th-surface-alt)] border-t border-[var(--th-border)] flex items-center justify-between gap-3 text-xs text-[var(--th-text-muted)]">
            <span className="truncate font-mono tabular-nums">
              {feedbackMsg ??
                `${folderCount} folder${folderCount === 1 ? '' : 's'} · ${audioFileCount} audio`}
            </span>
            <span className="whitespace-nowrap shrink-0">
              {handleStack.length > 0 ? 'Root permit saved' : 'Session folder'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
