import { useCallback, useEffect, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Download,
  HardDriveDownload,
  Loader2,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Playlist, RemoteAudioResult, Track } from '../types/music';
import {
  convertAudioBlobToMp3,
  DownloadFormat,
  downloadRemoteAudioBlob,
  fetchTrendingAudiusTracks,
  sanitizeAudioFilename,
  searchAudiusTracks,
  searchItunesPreviews,
} from '../utils/audioSearch';
import {
  loadCachedAudioBlob,
  triggerDeviceDownload,
} from '../utils/audioStorage';
import { formatTime } from '../utils/formatTime';
import { ArtworkImage } from './ArtworkImage';

const DOWNLOAD_FORMAT_KEY = 'hypeboom_download_format_v1';

function loadDefaultDownloadFormat(): DownloadFormat {
  if (typeof window === 'undefined') return 'mp3';
  try {
    const saved = window.localStorage.getItem(DOWNLOAD_FORMAT_KEY);
    return saved === 'original' ? 'original' : 'mp3';
  } catch {
    return 'mp3';
  }
}

interface AudioSearchPanelProps {
  savedDownloads: Track[];
  playlists: Playlist[];
  onPlayRemoteTrack: (result: RemoteAudioResult) => Track;
  onQueueRemoteTrack: (result: RemoteAudioResult) => Track;
  onSaveDownloadedAudio: (
    result: RemoteAudioResult,
    blob: Blob
  ) => Promise<Track>;
  onPlaySavedDownload: (track: Track) => void;
  onQueueSavedDownload: (track: Track) => void;
  onDeleteSavedDownload: (trackId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, track: Track) => Promise<void> | void;
  onCreatePlaylistWithTrack: (name: string, track: Track) => void;
}

export function AudioSearchPanel({
  savedDownloads,
  playlists,
  onPlayRemoteTrack,
  onQueueRemoteTrack,
  onSaveDownloadedAudio,
  onPlaySavedDownload,
  onQueueSavedDownload,
  onDeleteSavedDownload,
  onAddTrackToPlaylist,
  onCreatePlaylistWithTrack,
}: AudioSearchPanelProps) {
  const [subView, setSubView] = useState<'online' | 'downloads'>('online');
  const [catalog, setCatalog] = useState<'audius' | 'itunes'>('audius');
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>(
    loadDefaultDownloadFormat
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RemoteAudioResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [playlistMenuId, setPlaylistMenuId] = useState<string | null>(null);
  const [quickPlaylistName, setQuickPlaylistName] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const runSearch = useCallback(
    async (
      searchTerm: string,
      targetCatalog: 'audius' | 'itunes',
      signal?: AbortSignal
    ) => {
      setIsSearching(true);
      setErrorMsg(null);
      try {
        const items =
          targetCatalog === 'audius'
            ? searchTerm.trim()
              ? await searchAudiusTracks(searchTerm, signal)
              : await fetchTrendingAudiusTracks(signal)
            : await searchItunesPreviews(searchTerm, signal);

        if (signal?.aborted) return;
        setResults(items);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setErrorMsg(
          'Could not reach audio catalog right now. Try switching catalog or searching again.'
        );
      } finally {
        if (!signal?.aborted) {
          setIsSearching(false);
        }
      }
    },
    []
  );

  // Load trending tracks on initial mount
  useEffect(() => {
    const controller = new AbortController();
    runSearch('', 'audius', controller.signal);
    return () => controller.abort();
  }, [runSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, catalog);
  };

  const handleCatalogSwitch = (next: 'audius' | 'itunes') => {
    setCatalog(next);
    runSearch(query, next);
  };

  const handleFormatChange = (next: DownloadFormat) => {
    setDownloadFormat(next);
    try {
      window.localStorage.setItem(DOWNLOAD_FORMAT_KEY, next);
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleDownloadResult = async (result: RemoteAudioResult) => {
    if (downloadingIds.has(result.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(result.id));
    setErrorMsg(null);
    if (downloadFormat === 'mp3' && result.fileExt !== 'mp3') {
      showStatus(`Converting "${result.title}" to MP3...`);
    }
    try {
      const { blob, filename } = await downloadRemoteAudioBlob(
        result,
        downloadFormat
      );
      await onSaveDownloadedAudio(result, blob);
      triggerDeviceDownload(blob, filename);
      showStatus(`Downloaded "${filename}"`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : `Failed to download "${result.title}".`
      );
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };

  const handleReExportSaved = async (saved: Track) => {
    if (!saved.cacheKey) return;
    const cachedBlob = await loadCachedAudioBlob(saved.cacheKey);
    if (!cachedBlob) return;

    let exportBlob = cachedBlob;
    let ext: 'mp3' | 'm4a' =
      saved.fileExt ?? (saved.isPreview ? 'm4a' : 'mp3');

    if (
      downloadFormat === 'mp3' &&
      ext !== 'mp3' &&
      !cachedBlob.type.toLowerCase().includes('mpeg')
    ) {
      try {
        exportBlob = await convertAudioBlobToMp3(cachedBlob);
        ext = 'mp3';
      } catch {
        // Fallback to cached container if conversion fails
      }
    }

    const filename = sanitizeAudioFilename(saved.artist, saved.title, ext);
    triggerDeviceDownload(exportBlob, filename);
    showStatus(`Exported "${filename}"`);
  };

  const resultToTrack = (result: RemoteAudioResult): Track => ({
    id: result.id,
    title: result.title,
    artist: result.artist,
    album: result.album,
    duration: result.duration,
    artworkUrl: result.artworkUrl,
    audioUrl: result.streamUrl,
    remoteUrl: result.streamUrl,
    source: 'remote',
    isPreview: result.isPreview,
  });

  const savedIdSet = new Set(savedDownloads.map((d) => d.id));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Search & Catalog Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--th-border)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Search view"
            className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'online'}
              onClick={() => setSubView('online')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                subView === 'online'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              Online Search
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'downloads'}
              onClick={() => setSubView('downloads')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                subView === 'downloads'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <HardDriveDownload className="w-3 h-3" />
              <span>Downloads ({savedDownloads.length})</span>
            </button>
          </div>

          {subView === 'online' ? (
            <div
              role="group"
              aria-label="Audio catalog"
              className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
            >
              <button
                type="button"
                onClick={() => handleCatalogSwitch('audius')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  catalog === 'audius'
                    ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                MP3 Tracks
              </button>
              <button
                type="button"
                onClick={() => handleCatalogSwitch('itunes')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  catalog === 'itunes'
                    ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                30s Previews
              </button>
            </div>
          ) : null}
        </div>

        {subView === 'online' ? (
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-3.5 h-3.5 text-[var(--th-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.8}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  catalog === 'audius'
                    ? 'Search MP3 tracks with artwork...'
                    : 'Search songs or artists (30s preview)...'
                }
                aria-label="Search online audio"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--th-surface-alt)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] border border-[var(--th-border)] focus:outline-none focus:border-[var(--th-accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] text-[var(--th-text-muted)]">
          <span>Download format</span>
          <div
            role="group"
            aria-label="Download format"
            className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
          >
            <button
              type="button"
              onClick={() => handleFormatChange('mp3')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                downloadFormat === 'mp3'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              MP3 (Default)
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange('original')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                downloadFormat === 'original'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              Original
            </button>
          </div>
        </div>
      </div>

      {/* Results OR Offline Downloads List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--th-border)] max-h-[420px] lg:max-h-[450px]">
        {errorMsg ? (
          <div className="px-4 sm:px-5 py-2.5 text-xs text-red-500 bg-red-500/5">
            {errorMsg}
          </div>
        ) : null}

        {subView === 'online' ? (
          isSearching ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--th-accent-text)]" />
              <p className="mt-2.5 text-xs text-[var(--th-text-muted)]">
                Searching audio catalog...
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-medium text-[var(--th-text)]">
                No verified audio tracks with artwork found
              </p>
              <p className="mt-1 text-xs text-[var(--th-text-muted)]">
                Try another keyword or switch between MP3 Tracks and 30s Previews.
              </p>
            </div>
          ) : (
            results.map((item) => {
              const isDownloading = downloadingIds.has(item.id);
              const isSaved = savedIdSet.has(item.id);
              const showPlPicker = playlistMenuId === item.id;

              return (
                <div key={item.id} className="px-4 sm:px-5 py-2.5">
                  <div className="group flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onPlayRemoteTrack(item);
                        showStatus(`Streaming "${item.title}"`);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                    >
                      <div className="relative shrink-0">
                        <ArtworkImage
                          src={item.artworkUrl}
                          alt={item.title}
                          size="sm"
                        />
                        <span className="absolute inset-0 rounded-lg bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 text-white fill-current" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--th-text)] truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[var(--th-text-muted)] truncate mt-0.5 tabular-nums">
                          {item.artist} · {item.album} ·{' '}
                          {downloadFormat === 'mp3'
                            ? 'MP3'
                            : item.fileExt.toUpperCase()}
                          {item.isPreview ? ' · 30s Preview' : ''}
                          {item.duration > 0
                            ? ` · ${formatTime(item.duration)}`
                            : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onQueueRemoteTrack(item);
                          showStatus(`Queued "${item.title}"`);
                        }}
                        aria-label={`Add ${item.title} to queue`}
                        title="Add to queue"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPlaylistMenuId(showPlPicker ? null : item.id)
                        }
                        aria-label={`Save ${item.title} to playlist`}
                        title="Save to playlist"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          showPlPicker
                            ? 'text-[var(--th-accent-text)] bg-[var(--th-accent-soft)]'
                            : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
                        }`}
                      >
                        <BookmarkPlus className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => handleDownloadResult(item)}
                        aria-label={`Download ${item.title}`}
                        title={
                          isSaved
                            ? `Saved offline · click to re-download ${downloadFormat === 'mp3' ? 'MP3' : item.fileExt.toUpperCase()}`
                            : `Download ${downloadFormat === 'mp3' ? 'MP3' : item.fileExt.toUpperCase()} & save offline`
                        }
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isSaved
                            ? 'text-[var(--th-accent-text)] bg-[var(--th-accent-soft)]'
                            : 'text-[var(--th-text-muted)] hover:text-[var(--th-accent-text)] hover:bg-[var(--th-surface-hover)]'
                        }`}
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isSaved ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showPlPicker ? (
                    <div className="mt-2 ml-14 p-2.5 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] flex flex-col gap-2">
                      {playlists.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {playlists.map((pl) => (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                onAddTrackToPlaylist(
                                  pl.id,
                                  resultToTrack(item)
                                );
                                setPlaylistMenuId(null);
                                showStatus(`Saved to "${pl.name}"`);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-accent)] hover:text-[var(--th-accent-text)] transition-colors"
                            >
                              + {pl.name}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = quickPlaylistName.trim();
                          if (!trimmed) return;
                          onCreatePlaylistWithTrack(
                            trimmed,
                            resultToTrack(item)
                          );
                          setQuickPlaylistName('');
                          setPlaylistMenuId(null);
                          showStatus(`Created "${trimmed}" with track`);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={quickPlaylistName}
                          onChange={(e) => setQuickPlaylistName(e.target.value)}
                          placeholder="Or new playlist name..."
                          maxLength={48}
                          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] focus:outline-none focus:border-[var(--th-accent)]"
                        />
                        <button
                          type="submit"
                          disabled={!quickPlaylistName.trim()}
                          className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] disabled:opacity-40"
                        >
                          Create
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })
          )
        ) : savedDownloads.length === 0 ? (
          <div className="py-12 px-6 text-center flex flex-col items-center">
            <HardDriveDownload className="w-7 h-7 text-[var(--th-text-muted)]" />
            <p className="mt-2.5 text-sm font-medium text-[var(--th-text)]">
              No downloaded tracks yet
            </p>
            <p className="mt-1 text-xs text-[var(--th-text-muted)] max-w-xs">
              Click the download button on any search result to save the audio file to your device and keep an offline copy in HypeBoom.
            </p>
          </div>
        ) : (
          savedDownloads.map((saved) => (
            <div
              key={saved.id}
              className="group flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-[var(--th-surface-hover)] transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  onPlaySavedDownload(saved);
                  showStatus(`Playing "${saved.title}" offline`);
                }}
                className="flex-1 min-w-0 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
              >
                <ArtworkImage
                  src={saved.artworkUrl}
                  alt={saved.title}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--th-text)] truncate">
                    {saved.title}
                  </p>
                  <p className="text-xs text-[var(--th-text-muted)] truncate mt-0.5 tabular-nums">
                    {saved.artist} ·{' '}
                    {(
                      saved.fileExt ?? (saved.isPreview ? 'm4a' : 'mp3')
                    ).toUpperCase()}{' '}
                    · Saved Offline
                    {saved.duration > 0
                      ? ` · ${formatTime(saved.duration)}`
                      : ''}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onQueueSavedDownload(saved);
                    showStatus(`Queued "${saved.title}"`);
                  }}
                  aria-label={`Add ${saved.title} to queue`}
                  title="Add to queue"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-alt)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReExportSaved(saved)}
                  aria-label={`Save ${saved.title} file to device`}
                  title="Download file again"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-accent-text)] hover:bg-[var(--th-surface-alt)] transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSavedDownload(saved.id)}
                  aria-label={`Delete ${saved.title} from offline cache`}
                  title="Remove offline download"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-red-500 hover:bg-[var(--th-surface-alt)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 bg-[var(--th-surface-alt)] border-t border-[var(--th-border)] flex items-center justify-between gap-2 text-xs text-[var(--th-text-muted)]">
        <span className="truncate">
          {statusMsg ??
            (subView === 'online'
              ? catalog === 'audius'
                ? `Verified MP3 audio with artwork · download defaults to ${downloadFormat === 'mp3' ? 'MP3' : 'Original'}`
                : `30-second song previews with artwork · saved as ${downloadFormat === 'mp3' ? 'MP3' : 'M4A'}`
              : `${savedDownloads.length} offline file${savedDownloads.length === 1 ? '' : 's'} cached · export defaults to ${downloadFormat === 'mp3' ? 'MP3' : 'Original'}`)}
        </span>
      </div>
    </div>
  );
}
