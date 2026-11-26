export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseAudioFilename(filename: string): {
  title: string;
  artist: string;
} {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  const dashIndex = withoutExt.indexOf(' - ');
  if (dashIndex > 0 && dashIndex < withoutExt.length - 3) {
    return {
      artist: withoutExt.slice(0, dashIndex).trim(),
      title: withoutExt.slice(dashIndex + 3).trim(),
    };
  }
  return {
    title: withoutExt || 'Untitled Audio',
    artist: 'Local File',
  };
}
