import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ListMusic,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { formatTime } from '../utils/formatTime';
import { ArtworkImage } from './ArtworkImage';

interface PlaylistPanelProps {
  playlists: Playlist[];
  queueTracks: Track[];
  currentTrack: Track | null;
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
}

export function PlaylistPanel({
  playlists,
  queueTracks,
  currentTrack,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onMoveTrackInPlaylist,
  onPlayPlaylist,
  onQueuePlaylist,
}: PlaylistPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<'none' | 'empty' | 'fromQueue'>(
    'none'
  );
  const [newName, setNewName] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const editingPlaylist =
    playlists.find((p) => p.id === editingId) ?? null;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    if (createMode === 'fromQueue') {
      const created = onCreatePlaylist(trimmed, []);
      for (const track of queueTracks) {
        await onAddTrackToPlaylist(created.id, track);
      }
      showFeedback(`Saved "${created.name}" (${queueTracks.length} tracks)`);
    } else {
      const created = onCreatePlaylist(trimmed, []);
      setEditingId(created.id);
      setRenameDraft(created.name);
      showFeedback(`Created "${created.name}"`);
    }

    setNewName('');
    setCreateMode('none');
  };

  const openEditor = (playlist: Playlist) => {
    setEditingId(playlist.id);
    setRenameDraft(playlist.name);
    setConfirmDeleteId(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlaylist) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    onRenamePlaylist(editingPlaylist.id, trimmed);
    showFeedback('Playlist renamed');
  };

  if (editingPlaylist) {
    const totalDur = editingPlaylist.tracks.reduce(
      (sum, t) => sum + (t.duration || 0),
      0
    );
    const existingIds = new Set(editingPlaylist.tracks.map((t) => t.id));
    const addableFromQueue = queueTracks.filter((t) => !existingIds.has(t.id));

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor Top Bar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--th-border)] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Playlists
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-[var(--th-text-muted)]">
                {editingPlaylist.tracks.length} tracks · {formatTime(totalDur)}
              </span>
              {editingPlaylist.tracks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onPlayPlaylist(editingPlaylist)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Play
                </button>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={handleRenameSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={48}
              aria-label="Playlist name"
              className="flex-1 min-w-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text)] focus:outline-none focus:border-[var(--th-accent)]"
            />
            <button
              type="submit"
              disabled={
                !renameDraft.trim() ||
                renameDraft.trim() === editingPlaylist.name
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Rename
            </button>
          </form>
        </div>

        {/* Playlist Tracks + Add From Queue */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--th-border)] max-h-[420px] lg:max-h-[450px]">
          {editingPlaylist.tracks.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <p className="text-sm font-medium text-[var(--th-text)]">
                This playlist has no tracks yet
              </p>
              <p className="mt-1 text-xs text-[var(--th-text-muted)]">
                Add tracks from your current Queue below or from the Search tab.
              </p>
            </div>
          ) : (
            editingPlaylist.tracks.map((track, idx) => (
              <div
                key={`${track.id}-${idx}`}
                className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 hover:bg-[var(--th-surface-hover)] transition-colors"
              >
                <span className="w-5 text-[11px] font-mono tabular-nums text-[var(--th-text-muted)] shrink-0">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <ArtworkImage
                  src={track.artworkUrl}
                  alt={track.title}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--th-text)] truncate">
                    {track.title}
                  </p>
                  <p className="text-xs text-[var(--th-text-muted)] truncate">
                    {track.artist}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      onMoveTrackInPlaylist(editingPlaylist.id, idx, idx - 1)
                    }
                    aria-label={`Move ${track.title} up`}
                    title="Move up"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-alt)] disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === editingPlaylist.tracks.length - 1}
                    onClick={() =>
                      onMoveTrackInPlaylist(editingPlaylist.id, idx, idx + 1)
                    }
                    aria-label={`Move ${track.title} down`}
                    title="Move down"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-alt)] disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onRemoveTrackFromPlaylist(editingPlaylist.id, idx)
                    }
                    aria-label={`Remove ${track.title} from playlist`}
                    title="Remove from playlist"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--th-text-muted)] hover:text-red-500 hover:bg-[var(--th-surface-alt)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {addableFromQueue.length > 0 ? (
            <div className="px-4 sm:px-5 py-3 bg-[var(--th-surface-alt)]/55">
              <p className="text-[11px] font-medium text-[var(--th-text-muted)] mb-2">
                Add from current queue
              </p>
              <div className="space-y-1.5">
                {addableFromQueue.map((track) => (
                  <div
                    key={`add-${track.id}`}
                    className="flex items-center justify-between gap-2.5 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--th-text)] truncate">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[var(--th-text-muted)] truncate">
                        {track.artist}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onAddTrackToPlaylist(editingPlaylist.id, track)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-accent)] hover:text-[var(--th-accent-text)] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Editor Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[var(--th-surface-alt)] border-t border-[var(--th-border)] flex items-center justify-between gap-3 text-xs text-[var(--th-text-muted)]">
          <span>{feedbackMsg ?? 'Changes saved automatically'}</span>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="text-[var(--th-accent-text)] font-medium hover:underline whitespace-nowrap shrink-0"
          >
            Done editing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Action Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--th-border)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono tabular-nums text-[var(--th-text-muted)]">
            {playlists.length} saved playlist{playlists.length === 1 ? '' : 's'}
          </span>

          <div className="flex items-center gap-2">
            {queueTracks.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setCreateMode('fromQueue');
                  setNewName('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] text-[var(--th-text)] border border-[var(--th-border)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5 text-[var(--th-accent-text)]" />
                Save Queue
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setCreateMode('empty');
                setNewName('');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
              New Playlist
            </button>
          </div>
        </div>

        {createMode !== 'none' ? (
          <form
            onSubmit={handleCreateSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={
                createMode === 'fromQueue'
                  ? `Name for ${queueTracks.length}-track playlist...`
                  : 'New playlist name...'
              }
              maxLength={48}
              autoFocus
              aria-label="Playlist name"
              className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-accent)]"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] disabled:opacity-40 transition-colors shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMode('none');
                setNewName('');
              }}
              aria-label="Cancel"
              className="p-1.5 rounded-lg text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : null}
      </div>

      {/* Playlists List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--th-border)] max-h-[420px] lg:max-h-[450px]">
        {playlists.length === 0 ? (
          <div className="py-12 px-6 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text-muted)] flex items-center justify-center mb-3.5">
              <ListMusic className="w-6 h-6" strokeWidth={1.7} />
            </div>
            <p className="text-sm font-medium text-[var(--th-text)]">
              No saved playlists yet
            </p>
            <p className="mt-1.5 text-xs text-[var(--th-text-muted)] max-w-xs leading-relaxed">
              Save your current queue as a playlist or create a new one, then add, reorder, or edit tracks anytime.
            </p>
          </div>
        ) : (
          playlists.map((pl) => {
            const totalDur = pl.tracks.reduce(
              (acc, t) => acc + (t.duration || 0),
              0
            );
            const coverArt = pl.tracks.find((t) => t.artworkUrl)?.artworkUrl;
            const isConfirmingDelete = confirmDeleteId === pl.id;

            return (
              <div
                key={pl.id}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-[var(--th-surface-hover)] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => openEditor(pl)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
                >
                  <ArtworkImage src={coverArt} alt={pl.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--th-text)] truncate">
                      {pl.name}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[var(--th-text-muted)] mt-0.5">
                      {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                      {totalDur > 0 ? ` · ${formatTime(totalDur)}` : ''}
                    </p>
                  </div>
                </button>

                {isConfirmingDelete ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePlaylist(pl.id);
                        setConfirmDeleteId(null);
                        showFeedback(`Deleted "${pl.name}"`);
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-md text-xs font-medium text-[var(--th-text-muted)] hover:text-[var(--th-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={pl.tracks.length === 0}
                      onClick={() => onPlayPlaylist(pl)}
                      aria-label={`Play ${pl.name}`}
                      title="Play playlist"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-accent-text)] hover:bg-[var(--th-accent-soft)] disabled:opacity-30 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      disabled={pl.tracks.length === 0}
                      onClick={() => {
                        onQueuePlaylist(pl);
                        showFeedback(`Queued "${pl.name}"`);
                      }}
                      aria-label={`Add ${pl.name} to queue`}
                      title="Add playlist to queue"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-alt)] disabled:opacity-30 transition-colors"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(pl)}
                      aria-label={`Edit ${pl.name}`}
                      title="Edit playlist"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-alt)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(pl.id)}
                      aria-label={`Delete ${pl.name}`}
                      title="Delete playlist"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-red-500 hover:bg-[var(--th-surface-alt)] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 bg-[var(--th-surface-alt)] border-t border-[var(--th-border)] flex items-center justify-between gap-2 text-xs text-[var(--th-text-muted)]">
        <span className="truncate">
          {feedbackMsg ??
            (currentTrack
              ? `Playing: ${currentTrack.title}`
              : 'Create, save, edit, or delete playlists')}
        </span>
        {currentTrack && playlists.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onAddTrackToPlaylist(playlists[0].id, currentTrack);
              showFeedback(`Added to "${playlists[0].name}"`);
            }}
            className="text-[var(--th-accent-text)] font-medium hover:underline whitespace-nowrap shrink-0"
          >
            + Save playing
          </button>
        ) : null}
      </div>
    </div>
  );
}
