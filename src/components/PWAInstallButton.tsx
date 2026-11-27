import { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--th-surface-alt)] text-[var(--th-text)] border border-[var(--th-border)] hover:border-[var(--th-accent)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showIOSGuide ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[var(--th-surface)] border border-[var(--th-border)] p-5 shadow-xl text-[var(--th-text)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  Install HypeBoom on iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-1.5 text-xs text-[var(--th-text-muted)] list-decimal list-inside leading-relaxed">
                <li>Tap the Share button in Safari&apos;s toolbar.</li>
                <li>Scroll down and tap Add to Home Screen.</li>
                <li>Tap Add to launch HypeBoom as an app.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2 rounded-lg text-xs font-medium bg-[var(--th-accent)] text-[var(--th-accent-fg)] hover:bg-[var(--th-accent-hover)] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-lg bg-[var(--th-surface)] border border-[var(--th-border)] px-3 py-1.5 text-xs font-medium text-[var(--th-text)] shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[var(--th-accent-text)] shrink-0" />
      <span>Offline Mode · Saved tracks available</span>
    </div>
  );
}
