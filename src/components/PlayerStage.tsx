import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlignLeft,
  ArrowUpRight,
  BarChart3,
  CircleDot,
  Disc3,
  Palette,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  EqGains,
  EqPreset,
  EqPresetId,
  LowerStageMode,
  LyricLine,
  RepeatMode,
  StageView,
  Track,
  VisualizerStyle,
} from '../types/music';
import { formatTime } from '../utils/formatTime';
import { ArtworkImage } from './ArtworkImage';
import { AudioVisualizer, VISUALIZER_PALETTES } from './AudioVisualizer';
import { EqualizerPanel } from './EqualizerPanel';
import { LyricsPanel } from './LyricsPanel';

const VISUALIZER_ORDER: VisualizerStyle[] = ['bar', 'wave', 'circular'];

const VISUALIZER_LABELS: Record<VisualizerStyle, string> = {
  bar: 'Bars',
  wave: 'Wave',
  circular: 'Circular',
};

const LOWER_MODE_ORDER: LowerStageMode[] = ['artwork', 'visualizer', 'lyrics'];

const LOWER_MODE_LABELS: Record<LowerStageMode, string> = {
  artwork: 'Art',
  visualizer: 'Visual',
  lyrics: 'Lyrics',
};

interface PlayerStageProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  analyser: AnalyserNode | null;
  audioError: string | null;
  isDark: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onAddFilesClick: () => void;
  onUpdateLyrics: (trackId: string, lyrics: LyricLine[]) => void;
  eqGains: EqGains;
  eqPreset: EqPresetId;
  customEqPresets: EqPreset[];
  onEqBandChange: (bandIndex: number, gain: number) => void;
  onApplyEqPreset: (presetId: EqPresetId) => void;
  onSaveCustomEqPreset: (name: string) => void;
  onDeleteCustomEqPreset: (presetId: string) => void;
  onResetEq: () => void;
}

export function PlayerStage({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeatMode,
  analyser,
  audioError,
  isDark,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onAddFilesClick,
  onUpdateLyrics,
  eqGains,
  eqPreset,
  customEqPresets,
  onEqBandChange,
  onApplyEqPreset,
  onSaveCustomEqPreset,
  onDeleteCustomEqPreset,
  onResetEq,
}: PlayerStageProps) {
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const [stageView, setStageView] = useState<StageView>('visualizer');
  const [lowerMode, setLowerMode] = useState<LowerStageMode>('artwork');
  const [visualizerStyle, setVisualizerStyle] =
    useState<VisualizerStyle>('bar');
  const [paletteIndex, setPaletteIndex] = useState<number>(() =>
    Math.floor(Math.random() * VISUALIZER_PALETTES.length)
  );

  // Pick a fresh random color palette whenever the active track changes
  useEffect(() => {
    setPaletteIndex((prev) => {
      if (VISUALIZER_PALETTES.length <= 1) return 0;
      let next = Math.floor(Math.random() * VISUALIZER_PALETTES.length);
      if (next === prev) {
        next = (prev + 1) % VISUALIZER_PALETTES.length;
      }
      return next;
    });
  }, [track?.id]);

  const activePalette = VISUALIZER_PALETTES[paletteIndex];

  const randomizePalette = () => {
    setPaletteIndex((prev) => {
      if (VISUALIZER_PALETTES.length <= 1) return 0;
      let next = Math.floor(Math.random() * VISUALIZER_PALETTES.length);
      if (next === prev) {
        next = (prev + 1) % VISUALIZER_PALETTES.length;
      }
      return next;
    });
  };

  const cycleVisualizerStyle = () => {
    setVisualizerStyle((prev) => {
      const idx = VISUALIZER_ORDER.indexOf(prev);
      return VISUALIZER_ORDER[(idx + 1) % VISUALIZER_ORDER.length];
    });
  };

  const availableLowerModes = LOWER_MODE_ORDER.filter((m) => m !== stageView);
  const effectiveLowerMode: LowerStageMode = availableLowerModes.includes(
    lowerMode
  )
    ? lowerMode
    : availableLowerModes[0];

  const handleSelectStageView = (nextView: StageView) => {
    if (nextView === stageView) return;
    if (stageView !== 'eq' && nextView !== 'eq' && lowerMode === nextView) {
      setLowerMode(stageView);
    } else if (nextView !== 'eq' && lowerMode === nextView) {
      const fallback = LOWER_MODE_ORDER.find((m) => m !== nextView) ?? 'artwork';
      setLowerMode(fallback);
    }
    setStageView(nextView);
  };

  const handlePromoteLowerToFull = () => {
    const targetStage = effectiveLowerMode;
    if (stageView !== 'eq') {
      setLowerMode(stageView);
    }
    setStageView(targetStage);
  };

  const activeMiniLyricLine = useMemo(() => {
    const lines = track?.lyrics;
    if (!lines || lines.length === 0) return null;
    let found = lines[0];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.15) {
        found = lines[i];
      } else {
        break;
      }
    }
    return found.text;
  }, [track?.lyrics, currentTime]);

  const safeDuration = duration > 0 ? duration : track?.duration || 0;
  const progressPercent =
    safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  const handleScrub = (clientX: number) => {
    const el = scrubberRef.current;
    if (!el || safeDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  };

  const handleScrubberHover = (clientX: number) => {
    const el = scrubberRef.current;
    if (!el || safeDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHoverPercent(ratio * 100);
    setHoverTime(ratio * safeDuration);
  };

  if (!track) {
    return (
      <section className="flex-1 min-w-0 w-full flex flex-col items-center justify-center text-center py-12 px-5 sm:py-16 sm:px-8 rounded-2xl bg-[var(--th-surface)] border border-[var(--th-border)] min-h-[380px] sm:min-h-[480px]">
        <ArtworkImage alt="Empty queue" size="lg" />
        <h2 className="mt-6 font-display text-xl font-semibold text-[var(--th-text)]">
          No track selected
        </h2>
        <p className="mt-2 text-sm text-[var(--th-text-muted)] max-w-xs">
          Add audio files from your device or restore the built-in studio tracks to start listening.
        </p>
        <button
          type="button"
          onClick={onAddFilesClick}
          className="mt-6 px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
        >
          Add Audio Files
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Now Playing"
      className="flex-1 min-w-0 w-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 rounded-2xl bg-[var(--th-surface)] border border-[var(--th-border)]"
    >
      {/* Top: Stage Mode Toggle + Square Stage Frame */}
      <div className="flex flex-col items-center min-w-0 w-full">
        {/* Stage Header: Art / Visual / Lyrics / EQ Toggle + Contextual Controls */}
        <div className="w-full max-w-[360px] mb-3 flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Full-frame stage view"
            className="flex items-center gap-0.5 p-1 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={stageView === 'artwork'}
              onClick={() => handleSelectStageView('artwork')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                stageView === 'artwork'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Art</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={stageView === 'visualizer'}
              onClick={() => handleSelectStageView('visualizer')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                stageView === 'visualizer'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Visual</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={stageView === 'lyrics'}
              onClick={() => handleSelectStageView('lyrics')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                stageView === 'lyrics'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Lyrics</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={stageView === 'eq'}
              onClick={() => handleSelectStageView('eq')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                stageView === 'eq'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              <SlidersHorizontal
                className={`w-3.5 h-3.5 ${
                  eqPreset !== 'flat' ? 'text-[var(--th-accent-text)]' : ''
                }`}
                strokeWidth={2}
              />
              <span>EQ</span>
            </button>
          </div>

          {stageView === 'visualizer' ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={randomizePalette}
                aria-label={`Color palette: ${activePalette.name}. Click to randomize color palette.`}
                title={`Color: ${activePalette.name} (Click to randomize)`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text)] hover:opacity-90 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
              >
                <Palette
                  className="w-3.5 h-3.5"
                  style={{ color: activePalette.colors[0] }}
                  strokeWidth={2}
                />
              </button>

              <button
                type="button"
                onClick={cycleVisualizerStyle}
                aria-label={`Visualizer style: ${VISUALIZER_LABELS[visualizerStyle]}. Click to switch style.`}
                title={`Style: ${VISUALIZER_LABELS[visualizerStyle]} (Click to switch)`}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] border border-[var(--th-border)] text-[var(--th-text)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
              >
                {visualizerStyle === 'bar' ? (
                  <BarChart3
                    className="w-3.5 h-3.5"
                    style={{ color: activePalette.colors[0] }}
                    strokeWidth={2}
                  />
                ) : visualizerStyle === 'wave' ? (
                  <Activity
                    className="w-3.5 h-3.5"
                    style={{ color: activePalette.colors[0] }}
                    strokeWidth={2}
                  />
                ) : (
                  <CircleDot
                    className="w-3.5 h-3.5"
                    style={{ color: activePalette.colors[0] }}
                    strokeWidth={2}
                  />
                )}
                <span className="hidden sm:inline">
                  {VISUALIZER_LABELS[visualizerStyle]}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Full-Frame Square Stage: Artwork OR Visualizer OR Synced Lyrics OR 5-Band EQ */}
        <div className="relative aspect-square w-full max-w-[360px] rounded-2xl overflow-hidden bg-[var(--th-surface-alt)] border border-[var(--th-border)] shadow-sm">
          {stageView === 'artwork' ? (
            <ArtworkImage
              src={track.artworkUrl}
              alt={`${track.title} by ${track.artist}`}
              size="lg"
              isPlaying={isPlaying}
              className="max-w-none w-full h-full rounded-none border-0 shadow-none"
            />
          ) : stageView === 'visualizer' ? (
            <div
              onClick={cycleVisualizerStyle}
              className="w-full h-full cursor-pointer"
              title="Click to cycle visualizer style"
            >
              <AudioVisualizer
                analyser={analyser}
                isPlaying={isPlaying}
                isDark={isDark}
                style={visualizerStyle}
                palette={activePalette}
              />
            </div>
          ) : stageView === 'lyrics' ? (
            <LyricsPanel
              track={track}
              currentTime={currentTime}
              duration={safeDuration}
              onSeek={onSeek}
              onUpdateLyrics={onUpdateLyrics}
            />
          ) : (
            <EqualizerPanel
              gains={eqGains}
              activePreset={eqPreset}
              customPresets={customEqPresets}
              onBandChange={onEqBandChange}
              onSelectPreset={onApplyEqPreset}
              onSavePreset={onSaveCustomEqPreset}
              onDeletePreset={onDeleteCustomEqPreset}
              onReset={onResetEq}
            />
          )}
        </div>

        {/* Below Stage: Angled Secondary Preview (Artwork / Visual / Lyrics) + Track Identity */}
        <div className="mt-5 sm:mt-6 w-full max-w-[360px] flex items-center gap-3 sm:gap-4 text-left min-w-0">
          {effectiveLowerMode === 'visualizer' ? (
            <button
              type="button"
              onClick={handlePromoteLowerToFull}
              title="Click to expand visualizer to full frame"
              aria-label="Active mini visualizer. Click to move visualizer to full frame."
              className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl shrink-0 overflow-hidden bg-[var(--th-surface-alt)] border border-[var(--th-border)] shadow-md -rotate-6 hover:rotate-0 transition-transform duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
            >
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
              ) : null}
              <div className="relative w-full h-full">
                <AudioVisualizer
                  analyser={analyser}
                  isPlaying={isPlaying}
                  isDark={isDark}
                  style={visualizerStyle}
                  palette={activePalette}
                  compact
                />
              </div>
            </button>
          ) : effectiveLowerMode === 'lyrics' ? (
            <button
              type="button"
              onClick={handlePromoteLowerToFull}
              title="Click to expand lyrics to full frame"
              aria-label="Mini lyrics preview. Click to move lyrics to full frame."
              className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl shrink-0 overflow-hidden bg-[var(--th-surface-alt)] border border-[var(--th-border)] shadow-md -rotate-6 hover:rotate-0 transition-transform duration-200 ease-out cursor-pointer flex flex-col items-center justify-center p-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
            >
              {activeMiniLyricLine ? (
                <>
                  <span className="w-4 h-0.5 rounded-full bg-[var(--th-accent)] mb-1 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] leading-tight font-medium text-[var(--th-text)] line-clamp-3">
                    {activeMiniLyricLine}
                  </span>
                </>
              ) : (
                <>
                  <AlignLeft
                    className="w-4 h-4 text-[var(--th-accent-text)]"
                    strokeWidth={1.8}
                  />
                  <span className="mt-1 text-[10px] font-medium text-[var(--th-text-muted)]">
                    Lyrics
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePromoteLowerToFull}
              aria-label="Album artwork. Click to expand artwork to full frame."
              title="Click to expand album art to full frame"
              className="rounded-xl shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
            >
              <ArtworkImage
                src={track.artworkUrl}
                alt={`${track.title} by ${track.artist}`}
                size="md"
                isPlaying={isPlaying}
                className="-rotate-6 hover:rotate-0 transition-transform duration-200 ease-out"
              />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[var(--th-text)] truncate leading-tight">
              {track.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm text-[var(--th-text-muted)]">
              <span className="font-medium text-[var(--th-text)] truncate">
                {track.artist}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{track.album}</span>
              {track.bpm ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                    {track.bpm} BPM
                  </span>
                </>
              ) : null}
            </div>

            {/* Lower Angled Frame Switcher */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[var(--th-text-muted)]">
                Lower:
              </span>
              <div
                role="group"
                aria-label="Lower angled preview mode"
                className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--th-surface-alt)] border border-[var(--th-border)]"
              >
                {availableLowerModes.map((mode) => {
                  const selected = effectiveLowerMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setLowerMode(mode)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-xs'
                          : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                      }`}
                    >
                      {LOWER_MODE_LABELS[mode]}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handlePromoteLowerToFull}
                title={`Swap ${LOWER_MODE_LABELS[effectiveLowerMode]} into full frame`}
                aria-label={`Swap ${LOWER_MODE_LABELS[effectiveLowerMode]} into full frame`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-[var(--th-accent-text)] hover:bg-[var(--th-accent-soft)] transition-colors whitespace-nowrap"
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>Expand</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner if file fails to decode */}
      {audioError ? (
        <p
          role="alert"
          className="mb-3 text-center text-xs font-medium text-red-500"
        >
          {audioError}
        </p>
      ) : null}

      {/* Scrubber & Timestamps */}
      <div className="mt-5 w-full">
        <div
          ref={scrubberRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek audio position"
          aria-valuemin={0}
          aria-valuemax={Math.round(safeDuration)}
          aria-valuenow={Math.round(currentTime)}
          onClick={(e) => handleScrub(e.clientX)}
          onMouseMove={(e) => handleScrubberHover(e.clientX)}
          onMouseLeave={() => setHoverTime(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              onSeek(currentTime + 5);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              onSeek(currentTime - 5);
            }
          }}
          className="group relative py-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] rounded"
        >
          {/* Hover timestamp tooltip */}
          {hoverTime !== null ? (
            <div
              style={{ left: `${hoverPercent}%` }}
              className="pointer-events-none absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--th-text)] text-[var(--th-surface)] text-[11px] font-mono tabular-nums shadow-sm"
            >
              {formatTime(hoverTime)}
            </div>
          ) : null}

          <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[var(--th-accent)] transition-[width] duration-75 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[var(--th-accent)] border-2 border-[var(--th-surface)] shadow-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[var(--th-text-muted)]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="mt-5 flex items-center justify-center gap-2 sm:gap-5">
        <button
          type="button"
          onClick={onToggleShuffle}
          aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
          aria-pressed={shuffle}
          title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
            shuffle
              ? 'text-[var(--th-accent-text)] bg-[var(--th-accent-soft)]'
              : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
          }`}
        >
          <Shuffle className="w-[18px] h-[18px]" strokeWidth={1.9} />
        </button>

        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous track"
          title="Previous (P)"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] active:scale-[0.97] transition-all duration-150 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] focus-visible:ring-offset-2"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next track"
          title="Next (N)"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={onCycleRepeat}
          aria-label={`Repeat mode: ${repeatMode}`}
          title={`Repeat: ${repeatMode}`}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
            repeatMode !== 'off'
              ? 'text-[var(--th-accent-text)] bg-[var(--th-accent-soft)]'
              : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
          }`}
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="w-[18px] h-[18px]" strokeWidth={1.9} />
          ) : (
            <Repeat className="w-[18px] h-[18px]" strokeWidth={1.9} />
          )}
        </button>
      </div>

      {/* Volume Bar */}
      <div className="mt-6 pt-5 border-t border-[var(--th-border)] flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title="Mute (M)"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-[18px] h-[18px]" />
          ) : (
            <Volume2 className="w-[18px] h-[18px]" />
          )}
        </button>

        <div className="relative flex items-center w-40 sm:w-48">
          <div className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[var(--th-text-muted)]"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            className="studio-range relative z-10 w-full h-5"
          />
        </div>

        <span className="w-9 text-right text-xs font-mono tabular-nums text-[var(--th-text-muted)]">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </section>
  );
}
