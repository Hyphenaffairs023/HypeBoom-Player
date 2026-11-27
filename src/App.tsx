import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { BrandMark } from './components/BrandMark';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { PlayerStage } from './components/PlayerStage';
import { TrackQueue } from './components/TrackQueue';
import { THEME_OPTIONS } from './data/themes';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { usePlaylists } from './hooks/usePlaylists';
import { RightPanelTab, ThemeId } from './types/music';

const THEME_STORAGE_KEY = 'koto_theme_v1';

function loadSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved as ThemeId;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

export default function App() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    analyser,
    audioError,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    cycleRepeat,
    toggleShuffle,
    toggleMute,
    updateVolume,
    addLocalFiles,
    addLocalAudioItems,
    savedDownloads,
    playOrQueueRemoteTrack,
    saveDownloadedAudio,
    playSavedDownload,
    deleteSavedDownload,
    prepareTrackForPlaylist,
    loadPlaylistTracks,
    removeTrack,
    restoreSampleTracks,
    updateTrackLyrics,
    eqGains,
    eqPreset,
    customEqPresets,
    setEqBandGain,
    applyEqPreset,
    saveCustomEqPreset,
    deleteCustomEqPreset,
    resetEq,
  } = useAudioPlayer();

  const {
    playlists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    moveTrackInPlaylist,
  } = usePlaylists();

  const [theme, setTheme] = useState<ThemeId>(loadSavedTheme);
  const [rightTab, setRightTab] = useState<RightPanelTab>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  const activeTheme =
    THEME_OPTIONS.find((t) => t.id === theme) ?? THEME_OPTIONS[1];
  const isDark = activeTheme.isDark;

  // Sync data-theme attribute, .dark class, and localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme, isDark]);

  // Update browser tab title cleanly with current track when playing
  useEffect(() => {
    if (currentTrack && isPlaying) {
      document.title = `${currentTrack.title} — ${currentTrack.artist} · HypeBoom`;
    } else {
      document.title = 'HypeBoom — Studio Music Player';
    }
  }, [currentTrack, isPlaying]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(currentTime + 5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(currentTime - 5);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateVolume(volume + 0.05);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateVolume(volume - 0.05);
      } else if (e.key.toLowerCase() === 'n') {
        nextTrack();
      } else if (e.key.toLowerCase() === 'p') {
        prevTrack();
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    togglePlay,
    seek,
    currentTime,
    updateVolume,
    volume,
    nextTrack,
    prevTrack,
    toggleMute,
  ]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [tracks, searchQuery]);

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounterRef.current += 1;
        if (e.dataTransfer.types.includes('Files')) {
          setIsDraggingFiles(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDraggingFiles(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDraggingFiles(false);
        if (e.dataTransfer.files?.length) {
          addLocalFiles(e.dataTransfer.files);
        }
      }}
      className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col theme-canvas-bg text-[var(--th-text)] transition-colors duration-200"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) {
            addLocalFiles(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Drag & Drop Overlay */}
      {isDraggingFiles ? (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div className="px-8 py-10 rounded-2xl bg-[var(--th-surface)] border-2 border-dashed border-[var(--th-accent)] text-center max-w-sm shadow-xl">
            <Upload className="w-8 h-8 text-[var(--th-accent-text)] mx-auto" />
            <p className="mt-3 font-display text-lg font-semibold">
              Drop audio files to queue
            </p>
            <p className="mt-1 text-xs text-[var(--th-text-muted)]">
              Supports MP3, WAV, FLAC, M4A, and OGG
            </p>
          </div>
        </div>
      ) : null}

      {/* Top Bar: Unique HypeBoom Brand Identity */}
      <header className="w-full border-b border-[var(--th-border)] bg-[var(--th-surface)]/85 backdrop-blur-md">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          <BrandMark isPlaying={isPlaying} />
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 flex flex-col justify-center">
        <div className="w-full max-w-xl mx-auto lg:max-w-none grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          <div className="min-w-0 lg:col-span-6 flex flex-col">
            <PlayerStage
              track={currentTrack}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isMuted={isMuted}
              shuffle={shuffle}
              repeatMode={repeatMode}
              analyser={analyser}
              audioError={audioError}
              isDark={isDark}
              onTogglePlay={togglePlay}
              onPrev={prevTrack}
              onNext={nextTrack}
              onSeek={seek}
              onVolumeChange={updateVolume}
              onToggleMute={toggleMute}
              onToggleShuffle={toggleShuffle}
              onCycleRepeat={cycleRepeat}
              onAddFilesClick={handleOpenFilePicker}
              onUpdateLyrics={updateTrackLyrics}
              eqGains={eqGains}
              eqPreset={eqPreset}
              customEqPresets={customEqPresets}
              onEqBandChange={setEqBandGain}
              onApplyEqPreset={applyEqPreset}
              onSaveCustomEqPreset={saveCustomEqPreset}
              onDeleteCustomEqPreset={deleteCustomEqPreset}
              onResetEq={resetEq}
            />
          </div>

          <div className="min-w-0 lg:col-span-6 flex flex-col">
            <TrackQueue
              tracks={filteredTracks}
              totalTrackCount={tracks.length}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              searchQuery={searchQuery}
              rightTab={rightTab}
              onRightTabChange={setRightTab}
              onSearchChange={setSearchQuery}
              onSelectTrack={playTrack}
              onTogglePlay={togglePlay}
              onRemoveTrack={removeTrack}
              onRestoreSamples={restoreSampleTracks}
              onAddFilesClick={handleOpenFilePicker}
              onPlayLocalItems={(items) =>
                addLocalAudioItems(items, { playFirst: true })
              }
              onQueueLocalItems={(items) => addLocalAudioItems(items)}
              playlists={playlists}
              onCreatePlaylist={createPlaylist}
              onRenamePlaylist={renamePlaylist}
              onDeletePlaylist={deletePlaylist}
              onAddTrackToPlaylist={async (playlistId, track) => {
                const prepared = await prepareTrackForPlaylist(track);
                addTrackToPlaylist(playlistId, prepared);
              }}
              onRemoveTrackFromPlaylist={removeTrackFromPlaylist}
              onMoveTrackInPlaylist={moveTrackInPlaylist}
              onPlayPlaylist={(pl) => {
                loadPlaylistTracks(pl.tracks, {
                  replaceQueue: true,
                  playFirst: true,
                });
              }}
              onQueuePlaylist={(pl) => {
                loadPlaylistTracks(pl.tracks, {
                  replaceQueue: false,
                  playFirst: false,
                });
              }}
              savedDownloads={savedDownloads}
              onPlayRemoteTrack={(res) =>
                playOrQueueRemoteTrack(res, { playNow: true })
              }
              onQueueRemoteTrack={(res) =>
                playOrQueueRemoteTrack(res, { playNow: false })
              }
              onSaveDownloadedAudio={saveDownloadedAudio}
              onPlaySavedDownload={(saved) =>
                playSavedDownload(saved, { playNow: true })
              }
              onQueueSavedDownload={(saved) =>
                playSavedDownload(saved, { playNow: false })
              }
              onDeleteSavedDownload={deleteSavedDownload}
            />
          </div>
        </div>
      </main>

      {/* Quiet Footer: 6-Theme Selector */}
      <footer className="w-full border-t border-[var(--th-border)] bg-[var(--th-surface)]/50">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-center text-xs text-[var(--th-text-muted)]">
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="flex flex-wrap items-center justify-center gap-1 p-1 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
          >
            {THEME_OPTIONS.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setTheme(opt.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                    isSelected
                      ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                      : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/25 shrink-0"
                    style={{ backgroundColor: opt.swatchColor }}
                  />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      <OfflineIndicator />
    </div>
  );
}
