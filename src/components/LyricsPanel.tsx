import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, RefreshCw, Search, Upload } from 'lucide-react';
import { LyricLine, Track } from '../types/music';
import { formatTime } from '../utils/formatTime';
import { parseLyricsInput } from '../utils/lyricsParser';
import { fetchOnlineLyrics } from '../utils/lyricsSearch';

interface LyricsPanelProps {
  track: Track;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onUpdateLyrics: (trackId: string, lyrics: LyricLine[]) => void;
}

export function LyricsPanel({
  track,
  currentTime,
  duration,
  onSeek,
  onUpdateLyrics,
}: LyricsPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lrcFileInputRef = useRef<HTMLInputElement | null>(null);
  const searchedTrackIdsRef = useRef<Set<string>>(new Set());

  const [isEditing, setIsEditing] = useState(false);
  const [draftLyrics, setDraftLyrics] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');

  const lyrics = track.lyrics ?? [];

  const activeIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let found = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentTime + 0.15) {
        found = i;
      } else {
        break;
      }
    }
    return found;
  }, [lyrics, currentTime]);

  const runOnlineSearch = useCallback(
    async (queryTitle: string, queryArtist: string, signal?: AbortSignal) => {
      setIsSearching(true);
      setSearchStatus(null);
      try {
        const result = await fetchOnlineLyrics(
          queryTitle,
          queryArtist,
          duration || track.duration,
          signal
        );
        if (signal?.aborted) return;

        if (result && result.lyrics.length > 0) {
          onUpdateLyrics(track.id, result.lyrics);
          setSearchStatus(result.sourceLabel);
        } else if (result?.instrumental) {
          setSearchStatus('Track marked as instrumental online.');
        } else {
          setSearchStatus('No matching lyrics found online.');
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setSearchStatus('Could not reach online lyrics service.');
      } finally {
        if (!signal?.aborted) {
          setIsSearching(false);
        }
      }
    },
    [duration, track.duration, track.id, onUpdateLyrics]
  );

  useEffect(() => {
    setIsEditing(false);
    setDraftLyrics('');
    setSearchStatus(null);
    setCustomQuery(
      track.artist && track.artist !== 'Local File'
        ? `${track.artist} - ${track.title}`
        : track.title
    );

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    if (lyrics.length > 0 || searchedTrackIdsRef.current.has(track.id)) {
      return;
    }

    searchedTrackIdsRef.current.add(track.id);
    const controller = new AbortController();
    runOnlineSearch(track.title, track.artist, controller.signal);

    return () => {
      controller.abort();
    };
  }, [track.id, track.title, track.artist, lyrics.length, runOnlineSearch]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const activeEl = lineRefs.current[activeIndex];
    if (!container || !activeEl) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetTop =
      activeEl.offsetTop -
      container.clientHeight / 2 +
      activeEl.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [activeIndex]);

  const handleLoadLrcFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseLyricsInput(text, duration || track.duration || 180);
      if (parsed.length > 0) {
        onUpdateLyrics(track.id, parsed);
        setIsEditing(false);
      }
    } catch {
      // Ignore unreadable files
    }
  };

  const handleSaveDraft = () => {
    const parsed = parseLyricsInput(
      draftLyrics,
      duration || track.duration || 180
    );
    if (parsed.length > 0) {
      onUpdateLyrics(track.id, parsed);
      setIsEditing(false);
      setDraftLyrics('');
    }
  };

  const handleManualOnlineSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customQuery.trim();
    if (!trimmed) return;
    const dashIdx = trimmed.indexOf(' - ');
    if (dashIdx > 0) {
      runOnlineSearch(
        trimmed.slice(dashIdx + 3).trim(),
        trimmed.slice(0, dashIdx).trim()
      );
    } else {
      runOnlineSearch(trimmed, '');
    }
  };

  if (isEditing || lyrics.length === 0) {
    return (
      <div className="w-full h-full flex flex-col justify-between p-5 text-left">
        <input
          ref={lrcFileInputRef}
          type="file"
          accept=".lrc,.txt,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleLoadLrcFile(file);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {isEditing ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-[var(--th-text)]">
                Paste .lrc or plain lyrics
              </span>
              <button
                type="button"
                onClick={() => lrcFileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--th-accent-text)] hover:underline whitespace-nowrap shrink-0"
              >
                <Upload className="w-3 h-3" />
                Load .lrc
              </button>
            </div>
            <textarea
              value={draftLyrics}
              onChange={(e) => setDraftLyrics(e.target.value)}
              placeholder="[00:05.00] First line of lyrics&#10;[00:10.00] Second line..."
              className="flex-1 w-full resize-none rounded-lg p-3 text-xs font-mono bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-accent)]"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!draftLyrics.trim()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] disabled:opacity-40 transition-colors"
              >
                Save Lyrics
              </button>
            </div>
          </>
        ) : isSearching ? (
          <div className="my-auto flex flex-col items-center text-center px-4">
            <Loader2
              className="w-7 h-7 animate-spin text-[var(--th-accent-text)]"
              strokeWidth={1.8}
            />
            <p className="mt-3 text-sm font-medium text-[var(--th-text)]">
              Searching lyrics online…
            </p>
            <p className="mt-1 text-xs text-[var(--th-text-muted)] truncate max-w-[240px]">
              {track.title}
              {track.artist !== 'Local File' ? ` · ${track.artist}` : ''}
            </p>
          </div>
        ) : (
          <div className="my-auto flex flex-col items-center text-center px-3">
            <FileText
              className="w-7 h-7 text-[var(--th-text-muted)]"
              strokeWidth={1.5}
            />
            <p className="mt-2.5 text-sm font-medium text-[var(--th-text)]">
              {searchStatus || 'No lyrics loaded yet'}
            </p>

            <form
              onSubmit={handleManualOnlineSearch}
              className="mt-3 w-full max-w-[260px] flex items-center gap-1.5"
            >
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[var(--th-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="Artist - Song Title"
                  aria-label="Search online lyrics by artist and title"
                  className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] focus:outline-none focus:border-[var(--th-accent)]"
                />
              </div>
              <button
                type="submit"
                aria-label="Search lyrics online"
                title="Search lyrics online"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => lrcFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                Load .lrc
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0"
              >
                Paste Lyrics
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Top & bottom soft scroll-pass gradient masks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 z-10 bg-gradient-to-b from-[var(--th-surface-alt)] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 z-10 bg-gradient-to-t from-[var(--th-surface-alt)] to-transparent"
      />

      <div
        ref={scrollContainerRef}
        aria-label="Synchronized lyrics"
        className="w-full h-full overflow-y-auto px-5 py-24 space-y-3 scroll-smooth"
      >
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          return (
            <button
              key={`${line.time}-${index}`}
              ref={(el) => {
                lineRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onSeek(line.time)}
              title={`Jump to ${formatTime(line.time)}`}
              className={`group w-full text-left flex items-baseline gap-2.5 py-1 rounded-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                isActive
                  ? 'opacity-100 scale-[1.01] origin-left'
                  : isPast
                    ? 'opacity-40 hover:opacity-75'
                    : 'opacity-65 hover:opacity-90'
              }`}
            >
              <span
                className={`text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
                  isActive
                    ? 'text-[var(--th-accent-text)] font-medium'
                    : 'text-[var(--th-text-muted)]'
                }`}
              >
                {formatTime(line.time)}
              </span>
              <span
                className={`font-display text-[15px] sm:text-base leading-snug transition-colors ${
                  isActive
                    ? 'font-semibold text-[var(--th-text)]'
                    : 'font-medium text-[var(--th-text-muted)]'
                }`}
              >
                {line.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
