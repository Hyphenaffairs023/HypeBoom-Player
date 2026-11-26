import { useState } from 'react';
import {
  BookmarkPlus,
  FolderOpen,
  Globe,
  ListMusic,
  ListVideo,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Playlist,
  RemoteAudioResult,
  RightPanelTab,
  Track,
} from '../types/music';
import { formatTime } from '../utils/formatTime';
import { ArtworkImage } from './ArtworkImage';
import { AudioSearchPanel } from './AudioSearchPanel';
import { FolderBrowser, LocalAudioPayload } from './FolderBrowser';
import { PlaylistPanel } from './PlaylistPanel';

interface TrackQueueProps {
  tracks: Track[];
  totalTrackCount: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  searchQuery: string;
  rightTab: RightPanelTab;
  onRightTabChange: (tab: RightPanelTab) => void;
  onSearchChange: (value: string) => void;
  onSelectTrack: (trackId: string) => void;
  onTogglePlay: () => void;
  onRemoveTrack: (trackId: string) => void;
  onRestoreSamples: () => void;
  onAddFilesClick: () => void;
  onPlayLocalItems: (items: LocalAudioPayload[]) => void;
  onQueueLocalItems: (items: LocalAudioPayload[]) => void;
  playlists: Playlist[];
  onCreatePlaylist: (name: string, initialTracks?: Track[]) => Playlist;
  onRenamePlaylist: (playlistId: string, name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, track: Track) => Promise<void> | void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackIndex: number) => void;
  onMoveTrackInPlaylist: (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onQueuePlaylist: (playlist: Playlist) => void;
  savedDownloads: Track[];
  onPlayRemoteTrack: (result: RemoteAudioResult) => Track;
  onQueueRemoteTrack: (result: RemoteAudioResult) => Track;
  onSaveDownloadedAudio: (
    result: RemoteAudioResult,
    blob: Blob
  ) => Promise<Track>;
  onPlaySavedDownload: (track: Track) => void;
  onQueueSavedDownload: (track: Track) => void;
  onDeleteSavedDownload: (trackId: string) => void;
}

export function TrackQueue({
  tracks,
  totalTrackCount,
  currentTrack,
  isPlaying,
  searchQuery,
  rightTab,
  onRightTabChange,
  onSearchChange,
  onSelectTrack,
  onTogglePlay,
  onRemoveTrack,
  onRestoreSamples,
  onAddFilesClick,
  onPlayLocalItems,
  onQueueLocalItems,
  playlists,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onMoveTrackInPlaylist,
  onPlayPlaylist,
  onQueuePlaylist,
  savedDownloads,
  onPlayRemoteTrack,
  onQueueRemoteTrack,
  onSaveDownloadedAudio,
  onPlaySavedDownload,
  onQueueSavedDownload,
  onDeleteSavedDownload,
}: TrackQueueProps) {
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [quickPlName, setQuickPlName] = useState('');

  const currentTrackId = currentTrack?.id ?? null;
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return (
    <section
      aria-label="Library, Playlists, Search and Local Storage"
      className="flex-1 min-w-0 w-full flex flex-col rounded-2xl bg-[var(--th-surface)] border border-[var(--th-border)] overflow-hidden"
    >
      {/* Shared Right-Panel Top Bar: Queue | Playlists | Search | Folders */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3.5 sm:pb-4 border-b border-[var(--th-border)] flex flex-col gap-3.5 sm:gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Library panel view"
            className="inline-flex flex-wrap items-center gap-0.5 p-1 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] max-w-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'queue'}
              onClick={() => onRightTabChange('queue')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                rightTab === 'queue'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Queue
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'playlists'}
              onClick={() => onRightTabChange('playlists')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                rightTab === 'playlists'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" />
              Playlists
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'discover'}
              onClick={() => onRightTabChange('discover')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                rightTab === 'discover'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Search
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'folders'}
              onClick={() => onRightTabChange('folders')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                rightTab === 'folders'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Folders
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--th-text-muted)] font-mono tabular-nums whitespace-nowrap">
            <span>{tracks.length} tracks</span>
            <span aria-hidden="true">·</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {rightTab === 'queue' ? (
          <div className="relative">
            <Search
              className="w-4 h-4 text-[var(--th-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter queue by title, artist, or album"
              aria-label="Filter tracks"
              className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg bg-[var(--th-surface-alt)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] border border-[var(--th-border)] focus:outline-none focus:border-[var(--th-accent)] transition-colors"
            />
          </div>
        ) : null}
      </div>

      {/* Queue View */}
      <div
        className={
          rightTab === 'queue' ? 'flex-1 flex flex-col min-h-0' : 'hidden'
        }
      >
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--th-border)] max-h-[460px] lg:max-h-[490px]">
          {tracks.length === 0 ? (
            <div className="py-14 px-6 text-center flex flex-col items-center">
              <p className="text-sm font-medium text-[var(--th-text)]">
                {totalTrackCount === 0
                  ? 'Your queue is empty'
                  : 'No tracks match your search'}
              </p>
              <p className="mt-1.5 text-xs text-[var(--th-text-muted)] max-w-xs">
                {totalTrackCount === 0
                  ? 'Restore the built-in studio tracks, search online audio, open Folders, or drop files here.'
                  : 'Try clearing the search query to see all tracks.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {totalTrackCount === 0 ? (
                  <button
                    type="button"
                    onClick={onRestoreSamples}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] text-[var(--th-text)] border border-[var(--th-border)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Sample Tracks
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onAddFilesClick}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Add Audio
                </button>
              </div>
            </div>
          ) : (
            tracks.map((track, idx) => {
              const isActive = track.id === currentTrackId;
              const isSavingThis = savingTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-[var(--th-accent-soft)]'
                      : 'hover:bg-[var(--th-surface-hover)]'
                  }`}
                >
                  <div className="group flex items-center gap-3 px-4 sm:px-5 py-3">
                    {/* Index / Play button */}
                    <button
                      type="button"
                      onClick={() =>
                        isActive ? onTogglePlay() : onSelectTrack(track.id)
                      }
                      aria-label={
                        isActive && isPlaying
                          ? `Pause ${track.title}`
                          : `Play ${track.title}`
                      }
                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-xs font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                    >
                      {isActive && isPlaying ? (
                        <span
                          className="flex items-end gap-[2px] h-3.5"
                          aria-hidden="true"
                        >
                          <span className="w-[2.5px] h-full bg-[var(--th-accent-text)] rounded-full animate-eq-1" />
                          <span className="w-[2.5px] h-full bg-[var(--th-accent-text)] rounded-full animate-eq-2" />
                          <span className="w-[2.5px] h-full bg-[var(--th-accent-text)] rounded-full animate-eq-3" />
                        </span>
                      ) : (
                        <>
                          <span
                            className={`group-hover:hidden ${
                              isActive
                                ? 'text-[var(--th-accent-text)] font-medium'
                                : 'text-[var(--th-text-muted)]'
                            }`}
                          >
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="hidden group-hover:flex text-[var(--th-text)]">
                            {isActive && isPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current text-[var(--th-accent-text)]" />
                            )}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Main clickable row area */}
                    <button
                      type="button"
                      onClick={() =>
                        isActive ? onTogglePlay() : onSelectTrack(track.id)
                      }
                      className="flex-1 min-w-0 flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] rounded"
                    >
                      <ArtworkImage
                        src={track.artworkUrl}
                        alt={track.title}
                        size="sm"
                        isPlaying={isActive && isPlaying}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive
                              ? 'text-[var(--th-accent-text)]'
                              : 'text-[var(--th-text)]'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-xs text-[var(--th-text-muted)] truncate mt-0.5">
                          {track.artist} · {track.album}
                        </p>
                      </div>
                    </button>

                    {/* Duration, Save to Playlist, Remove */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-[var(--th-text-muted)] mr-1">
                        {track.duration > 0 ? formatTime(track.duration) : '--:--'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSavingTrackId(isSavingThis ? null : track.id)
                        }
                        aria-label={`Save ${track.title} to playlist`}
                        title="Save to playlist"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                          isSavingThis
                            ? 'text-[var(--th-accent-text)] bg-[var(--th-accent-soft)] opacity-100'
                            : 'text-[var(--th-text-muted)] hover:text-[var(--th-accent-text)] hover:bg-[var(--th-surface-hover)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                        }`}
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveTrack(track.id)}
                        aria-label={`Remove ${track.title} from queue`}
                        title="Remove from queue"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-red-500 hover:bg-[var(--th-surface-hover)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isSavingThis ? (
                    <div className="mx-4 sm:mx-5 mb-3 p-2.5 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] flex flex-col gap-2">
                      {playlists.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {playlists.map((pl) => (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                onAddTrackToPlaylist(pl.id, track);
                                setSavingTrackId(null);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-accent)] hover:text-[var(--th-accent-text)] transition-colors"
                            >
                              + {pl.name}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const trimmed = quickPlName.trim();
                          if (!trimmed) return;
                          const created = onCreatePlaylist(trimmed, []);
                          await onAddTrackToPlaylist(created.id, track);
                          setQuickPlName('');
                          setSavingTrackId(null);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={quickPlName}
                          onChange={(e) => setQuickPlName(e.target.value)}
                          placeholder="New playlist name..."
                          maxLength={48}
                          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] focus:outline-none focus:border-[var(--th-accent)]"
                        />
                        <button
                          type="submit"
                          disabled={!quickPlName.trim()}
                          className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] disabled:opacity-40"
                        >
                          Save
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Subtle Local File Drop Footer */}
        <div className="px-4 sm:px-5 py-3.5 bg-[var(--th-surface-alt)] border-t border-[var(--th-border)] flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs text-[var(--th-text-muted)]">
          <span className="min-w-0">
            Drag & drop MP3, WAV, FLAC, or OGG files anywhere to queue
          </span>
          <button
            type="button"
            onClick={onAddFilesClick}
            className="text-[var(--th-text)] font-medium hover:text-[var(--th-accent-text)] transition-colors whitespace-nowrap shrink-0"
          >
            Browse files
          </button>
        </div>
      </div>

      {/* Playlists View */}
      <div
        className={
          rightTab === 'playlists' ? 'flex-1 flex flex-col min-h-0' : 'hidden'
        }
      >
        <PlaylistPanel
          playlists={playlists}
          queueTracks={tracks}
          currentTrack={currentTrack}
          onCreatePlaylist={onCreatePlaylist}
          onRenamePlaylist={onRenamePlaylist}
          onDeletePlaylist={onDeletePlaylist}
          onAddTrackToPlaylist={onAddTrackToPlaylist}
          onRemoveTrackFromPlaylist={onRemoveTrackFromPlaylist}
          onMoveTrackInPlaylist={onMoveTrackInPlaylist}
          onPlayPlaylist={onPlayPlaylist}
          onQueuePlaylist={onQueuePlaylist}
        />
      </div>

      {/* Self Audio Search & Download View */}
      <div
        className={
          rightTab === 'discover' ? 'flex-1 flex flex-col min-h-0' : 'hidden'
        }
      >
        <AudioSearchPanel
          savedDownloads={savedDownloads}
          playlists={playlists}
          onPlayRemoteTrack={onPlayRemoteTrack}
          onQueueRemoteTrack={onQueueRemoteTrack}
          onSaveDownloadedAudio={onSaveDownloadedAudio}
          onPlaySavedDownload={onPlaySavedDownload}
          onQueueSavedDownload={onQueueSavedDownload}
          onDeleteSavedDownload={onDeleteSavedDownload}
          onAddTrackToPlaylist={onAddTrackToPlaylist}
          onCreatePlaylistWithTrack={async (name, track) => {
            const created = onCreatePlaylist(name, []);
            await onAddTrackToPlaylist(created.id, track);
          }}
        />
      </div>

      {/* Persistent Folders View */}
      <div
        className={
          rightTab === 'folders' ? 'flex-1 flex flex-col min-h-0' : 'hidden'
        }
      >
        <FolderBrowser
          onPlayLocalItems={onPlayLocalItems}
          onQueueLocalItems={onQueueLocalItems}
        />
      </div>
    </section>
  );
}

