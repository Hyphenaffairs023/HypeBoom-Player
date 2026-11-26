import { useCallback, useEffect, useState } from 'react';
import { Playlist, Track } from '../types/music';

const PLAYLISTS_STORAGE_KEY = 'hypeboom_playlists_v1';

function sanitizeTrackForStorage(track: Track): Track {
  return {
    ...track,
    audioUrl:
      track.audioUrl && !track.audioUrl.startsWith('blob:')
        ? track.audioUrl
        : undefined,
  };
}

function loadSavedPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is Playlist =>
          Boolean(p) &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          Array.isArray(p.tracks)
      )
      .map((p) => ({
        id: p.id,
        name: p.name.trim() || 'Untitled Playlist',
        tracks: p.tracks.filter(
          (t): t is Track => Boolean(t && typeof t.id === 'string' && typeof t.title === 'string')
        ),
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(loadSavedPlaylists);

  useEffect(() => {
    try {
      const serializable = playlists.map((p) => ({
        ...p,
        tracks: p.tracks.map(sanitizeTrackForStorage),
      }));
      window.localStorage.setItem(
        PLAYLISTS_STORAGE_KEY,
        JSON.stringify(serializable)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [playlists]);

  const createPlaylist = useCallback(
    (name: string, initialTracks: Track[] = []): Playlist => {
      const cleanName = name.trim().slice(0, 48) || 'Untitled Playlist';
      const now = Date.now();
      const created: Playlist = {
        id: `pl-${now}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        tracks: initialTracks.map(sanitizeTrackForStorage),
        createdAt: now,
        updatedAt: now,
      };
      setPlaylists((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const renamePlaylist = useCallback((playlistId: string, nextName: string) => {
    const clean = nextName.trim().slice(0, 48);
    if (!clean) return;
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId ? { ...p, name: clean, updatedAt: Date.now() } : p
      )
    );
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, track: Track) => {
    const clean = sanitizeTrackForStorage(track);
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const alreadyExists = p.tracks.some(
          (t) =>
            t.id === clean.id ||
            (t.title.toLowerCase() === clean.title.toLowerCase() &&
              t.artist.toLowerCase() === clean.artist.toLowerCase())
        );
        if (alreadyExists) return p;
        return {
          ...p,
          tracks: [...p.tracks, clean],
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, trackIndex: number) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          return {
            ...p,
            tracks: p.tracks.filter((_, idx) => idx !== trackIndex),
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  const moveTrackInPlaylist = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= p.tracks.length ||
            toIndex >= p.tracks.length ||
            fromIndex === toIndex
          ) {
            return p;
          }
          const copy = [...p.tracks];
          const [moved] = copy.splice(fromIndex, 1);
          copy.splice(toIndex, 0, moved);
          return {
            ...p,
            tracks: copy,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  return {
    playlists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    moveTrackInPlaylist,
  };
}
