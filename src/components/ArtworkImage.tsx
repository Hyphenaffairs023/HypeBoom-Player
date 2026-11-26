import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  isPlaying?: boolean;
  className?: string;
}

export function ArtworkImage({
  src,
  alt,
  size = 'lg',
  isPlaying = false,
  className = '',
}: ArtworkImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showFallback = !src || hasError;

  const sizeClasses =
    size === 'lg'
      ? 'aspect-square w-full max-w-[340px] rounded-2xl shadow-sm'
      : size === 'md'
        ? 'w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl shrink-0 shadow-md'
        : 'w-11 h-11 rounded-lg shrink-0';

  const iconSizeClasses =
    size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-7 h-7' : 'w-5 h-5';

  return (
    <div
      className={`relative overflow-hidden select-none bg-[var(--th-surface-alt)] border border-[var(--th-border)] ${sizeClasses} ${className}`}
    >
      {showFallback ? (
        <div className="w-full h-full flex items-center justify-center bg-[var(--th-surface-alt)]">
          <Disc3
            className={`text-[var(--th-text-muted)] transition-transform duration-700 ${iconSizeClasses} ${
              isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
            }`}
            strokeWidth={1.5}
          />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover transition-transform duration-500 ease-out"
        />
      )}
    </div>
  );
}
