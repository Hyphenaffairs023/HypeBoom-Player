import { LyricLine } from '../types/music';
import { parseLyricsInput } from './lyricsParser';

interface LrcLibRecord {
  id: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

export interface LyricsSearchResult {
  lyrics: LyricLine[];
  sourceLabel: string;
  instrumental?: boolean;
}

export async function fetchOnlineLyrics(
  title: string,
  artist: string,
  duration?: number,
  signal?: AbortSignal
): Promise<LyricsSearchResult | null> {
  const cleanTitle = title.trim();
  const cleanArtist =
    artist && artist !== 'Local File' ? artist.trim() : '';

  if (!cleanTitle) return null;

  // 1. Try exact match via LRCLIB /api/get when artist is known
  if (cleanArtist) {
    try {
      const params = new URLSearchParams({
        track_name: cleanTitle,
        artist_name: cleanArtist,
      });
      if (duration && duration > 0) {
        params.set('duration', String(Math.round(duration)));
      }
      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        signal,
      });
      if (res.ok) {
        const data = (await res.json()) as LrcLibRecord;
        const raw = data.syncedLyrics || data.plainLyrics;
        if (raw) {
          const parsed = parseLyricsInput(raw, duration || data.duration || 180);
          if (parsed.length > 0) {
            return {
              lyrics: parsed,
              sourceLabel: data.syncedLyrics ? 'Synced via LRCLIB' : 'Lyrics via LRCLIB',
            };
          }
        } else if (data.instrumental) {
          return { lyrics: [], sourceLabel: 'Instrumental', instrumental: true };
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
    }
  }

  // 2. Fallback to fuzzy search via LRCLIB /api/search
  try {
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
      { signal }
    );
    if (res.ok) {
      const results = (await res.json()) as LrcLibRecord[];
      if (Array.isArray(results) && results.length > 0) {
        // Prefer entries with syncedLyrics first
        const best =
          results.find((r) => Boolean(r.syncedLyrics)) ??
          results.find((r) => Boolean(r.plainLyrics)) ??
          results[0];

        const raw = best.syncedLyrics || best.plainLyrics;
        if (raw) {
          const parsed = parseLyricsInput(raw, duration || best.duration || 180);
          if (parsed.length > 0) {
            return {
              lyrics: parsed,
              sourceLabel: best.syncedLyrics ? 'Synced via LRCLIB' : 'Lyrics via LRCLIB',
            };
          }
        } else if (best.instrumental) {
          return { lyrics: [], sourceLabel: 'Instrumental', instrumental: true };
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
  }

  return null;
}
