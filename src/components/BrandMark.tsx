interface BrandMarkProps {
  isPlaying?: boolean;
}

export function BrandMark({ isPlaying = false }: BrandMarkProps) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      {/* Bespoke Sound + Acoustic Art Emblem */}
      <div
        aria-hidden="true"
        className="relative w-9 h-9 rounded-xl bg-[var(--th-accent)] text-[var(--th-accent-fg)] flex items-center justify-center shadow-xs overflow-hidden shrink-0"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Acoustic resonance rings (Art) */}
          <circle
            cx="18"
            cy="18"
            r="14.5"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />
          <path
            d="M7.5 18C7.5 12.201 12.201 7.5 18 7.5"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M28.5 18C28.5 23.799 23.799 28.5 18 28.5"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Sculpted Boom Soundwave Bars (Sound) */}
          <rect
            x="10.5"
            y="14"
            width="2.4"
            height="8"
            rx="1.2"
            fill="currentColor"
            className={isPlaying ? 'animate-eq-2' : undefined}
            style={{ transformOrigin: '11.7px 22px' }}
          />
          <rect
            x="14.7"
            y="9.5"
            width="2.6"
            height="17"
            rx="1.3"
            fill="currentColor"
            className={isPlaying ? 'animate-eq-1' : undefined}
            style={{ transformOrigin: '16px 26.5px' }}
          />
          <rect
            x="19.1"
            y="11.5"
            width="2.6"
            height="13"
            rx="1.3"
            fill="currentColor"
            className={isPlaying ? 'animate-eq-3' : undefined}
            style={{ transformOrigin: '20.4px 24.5px' }}
          />
          <rect
            x="23.5"
            y="15"
            width="2.4"
            height="6"
            rx="1.2"
            fill="currentColor"
            className={isPlaying ? 'animate-eq-1' : undefined}
            style={{ transformOrigin: '24.7px 21px' }}
          />
        </svg>
      </div>

      {/* Signature Sculpted Brand Typography */}
      <span className="font-brand text-[21px] sm:text-[22px] font-extrabold tracking-[-0.04em] leading-none whitespace-nowrap">
        <span className="text-[var(--th-text)]">Hype</span>
        <span className="text-[var(--th-accent-text)]">Boom</span>
      </span>
    </div>
  );
}
