import { useRef, useState } from 'react';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { EQ_BANDS, EQ_PRESETS } from '../data/eqPresets';
import { EqGains, EqPreset, EqPresetId } from '../types/music';

interface EqualizerPanelProps {
  gains: EqGains;
  activePreset: EqPresetId;
  customPresets: EqPreset[];
  onBandChange: (bandIndex: number, gain: number) => void;
  onSelectPreset: (presetId: EqPresetId) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onReset: () => void;
}

const MIN_DB = -12;
const MAX_DB = 12;

export function EqualizerPanel({
  gains,
  activePreset,
  customPresets,
  onBandChange,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  onReset,
}: EqualizerPanelProps) {
  const draggingIndexRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');

  const allPresets = [...EQ_PRESETS, ...customPresets];

  const updateFromPointer = (
    bandIndex: number,
    clientY: number,
    el: HTMLDivElement
  ) => {
    const rect = el.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const db = MIN_DB + ratio * (MAX_DB - MIN_DB);
    onBandChange(bandIndex, db);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = presetName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed);
    setPresetName('');
    setIsSaving(false);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-5 select-none">
      {/* Top: Built-in & Custom Preset Selector */}
      <div className="flex flex-wrap items-center gap-1 max-h-[62px] overflow-y-auto pr-0.5">
        {allPresets.map((preset) => {
          const isSelected = activePreset === preset.id;
          return (
            <div
              key={preset.id}
              className={`inline-flex items-center rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                isSelected
                  ? 'bg-[var(--th-accent)] text-[var(--th-accent-fg)] shadow-xs'
                  : 'bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)] hover:text-[var(--th-text)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={`py-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] rounded-md ${
                  preset.isCustom ? 'pl-2 pr-1' : 'px-2'
                }`}
              >
                {preset.label}
              </button>

              {preset.isCustom ? (
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  aria-label={`Delete custom preset ${preset.label}`}
                  title={`Delete ${preset.label}`}
                  className={`pr-1.5 pl-0.5 py-1 rounded-r-md transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] ${
                    isSelected
                      ? 'opacity-80 hover:opacity-100'
                      : 'text-[var(--th-text-muted)] hover:text-red-500'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          );
        })}

        {activePreset === 'custom' ? (
          <span className="px-1.5 py-1 text-[11px] font-medium text-[var(--th-accent-text)] whitespace-nowrap">
            Custom
          </span>
        ) : null}
      </div>

      {/* Middle: 5 Vertical Studio Faders */}
      <div className="flex-1 my-3 grid grid-cols-5 gap-2 items-stretch min-h-[115px]">
        {EQ_BANDS.map((band, idx) => {
          const gain = gains[idx] ?? 0;
          const percent = ((gain - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
          const formatted =
            gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1);

          return (
            <div
              key={band.frequency}
              className="flex flex-col items-center justify-between gap-1.5"
            >
              <span className="text-[11px] font-mono tabular-nums text-[var(--th-text-muted)]">
                {formatted}
              </span>

              <div
                role="slider"
                tabIndex={0}
                aria-label={`${band.label} equalizer band`}
                aria-valuemin={MIN_DB}
                aria-valuemax={MAX_DB}
                aria-valuenow={gain}
                title={`${band.label}: ${formatted} dB (double-click to zero)`}
                onDoubleClick={() => onBandChange(idx, 0)}
                onPointerDown={(e) => {
                  draggingIndexRef.current = idx;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateFromPointer(idx, e.clientY, e.currentTarget);
                }}
                onPointerMove={(e) => {
                  if (draggingIndexRef.current !== idx) return;
                  updateFromPointer(idx, e.clientY, e.currentTarget);
                }}
                onPointerUp={() => {
                  draggingIndexRef.current = null;
                }}
                onPointerCancel={() => {
                  draggingIndexRef.current = null;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    onBandChange(idx, gain + 0.5);
                  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    onBandChange(idx, gain - 0.5);
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    onBandChange(idx, 0);
                  }
                }}
                className="relative flex-1 w-9 flex items-center justify-center cursor-ns-resize touch-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
              >
                {/* Track */}
                <div className="relative w-1.5 h-full rounded-full bg-black/10 dark:bg-white/12 overflow-hidden">
                  {/* Center 0 dB hairline */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-px h-[2px] bg-black/20 dark:bg-white/25" />

                  {/* Active Fill from 0 dB center */}
                  <div
                    className="absolute inset-x-0 rounded-full bg-[var(--th-accent)] transition-[top,height] duration-75"
                    style={{
                      top: gain >= 0 ? `${100 - percent}%` : '50%',
                      height: `${Math.abs(percent - 50)}%`,
                    }}
                  />
                </div>

                {/* Tactile Fader Cap */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-3 rounded-sm bg-[var(--th-surface)] border border-[var(--th-border)] shadow-sm pointer-events-none"
                  style={{ bottom: `${percent}%` }}
                />
              </div>

              <span className="text-[11px] font-mono tabular-nums text-[var(--th-text-muted)]">
                {band.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom: Inline Save Preset Form OR Scale + Actions */}
      <div className="pt-2 border-t border-[var(--th-border)]">
        {isSaving ? (
          <form
            onSubmit={handleSaveSubmit}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSaving(false);
                  setPresetName('');
                }
              }}
              placeholder="Preset name (e.g. Warm Vinyl)"
              maxLength={28}
              autoFocus
              aria-label="Custom preset name"
              className="flex-1 min-w-0 px-2.5 py-1 text-xs rounded-md bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-accent)]"
            />
            <button
              type="submit"
              disabled={!presetName.trim()}
              aria-label="Confirm save preset"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] disabled:opacity-40 transition-colors shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSaving(false);
                setPresetName('');
              }}
              aria-label="Cancel saving preset"
              className="p-1 rounded-md text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--th-text-muted)]">
            <span className="font-mono tabular-nums">±12 dB · 5-Band</span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onReset}
                disabled={activePreset === 'flat'}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--th-text)] hover:text-[var(--th-accent-text)] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] rounded px-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>

              <button
                type="button"
                onClick={() => setIsSaving(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
              >
                <Plus className="w-3 h-3" strokeWidth={2.3} />
                Save Preset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
