import { useCallback, useEffect, useRef, useState } from 'react';
import { EQ_BANDS, EQ_PRESETS } from '../data/eqPresets';
import { SAMPLE_TRACKS } from '../data/sampleTracks';
import {
  EqGains,
  EqPreset,
  EqPresetId,
  LyricLine,
  RemoteAudioResult,
  RepeatMode,
  Track,
} from '../types/music';
import {
  deleteCachedAudioBlob,
  loadCachedAudioBlob,
  loadSavedDownloadMeta,
  saveCachedAudioBlob,
  saveDownloadMeta,
} from '../utils/audioStorage';
import { getOrCreateSynthUrl } from '../utils/audioSynth';
import { parseAudioFilename } from '../utils/formatTime';
import { parseLyricsInput } from '../utils/lyricsParser';
import { fetchOnlineLyrics } from '../utils/lyricsSearch';

const CUSTOM_EQ_STORAGE_KEY = 'koto_custom_eq_presets_v1';

function loadSavedCustomPresets(): EqPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_EQ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is EqPreset =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.label === 'string' &&
          Array.isArray(item.gains) &&
          item.gains.length === 5 &&
          item.gains.every((g: unknown) => typeof g === 'number' && Number.isFinite(g))
      )
      .map((item) => ({
        id: item.id,
        label: item.label.trim().slice(0, 28) || 'Custom Preset',
        gains: item.gains.map((g) =>
          Math.max(-12, Math.min(12, Math.round(g * 2) / 2))
        ) as EqGains,
        isCustom: true,
      }));
  } catch {
    return [];
  }
}

interface AudioGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  filters: BiquadFilterNode[];
}

const audioGraphMap = new WeakMap<HTMLAudioElement, AudioGraph>();

export function useAudioPlayer() {
  const [tracks, setTracks] = useState<Track[]>(SAMPLE_TRACKS);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(
    SAMPLE_TRACKS[0].id
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(SAMPLE_TRACKS[0].duration);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [eqGains, setEqGains] = useState<EqGains>([0, 0, 0, 0, 0]);
  const [eqPreset, setEqPreset] = useState<EqPresetId>('flat');
  const [customEqPresets, setCustomEqPresets] = useState<EqPreset[]>(
    loadSavedCustomPresets
  );
  const [savedDownloads, setSavedDownloads] = useState<Track[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const prefetchedLyricsIdsRef = useRef<Set<string>>(new Set());
  const tracksRef = useRef<Track[]>(tracks);
  tracksRef.current = tracks;
  const savedDownloadsRef = useRef<Track[]>(savedDownloads);
  savedDownloadsRef.current = savedDownloads;
  const blobByTrackIdRef = useRef<Map<string, Blob>>(new Map());
  const eqGainsRef = useRef<EqGains>(eqGains);
  eqGainsRef.current = eqGains;

  const currentTrack =
    tracks.find((t) => t.id === currentTrackId) ?? tracks[0] ?? null;

  // Ensure single HTMLAudioElement instance
  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
  }

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return null;

    let graph = audioGraphMap.get(audio);
    if (!graph) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(audio);
        const filters = EQ_BANDS.map((band, idx) => {
          const filter = ctx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.value = band.frequency;
          filter.Q.value = band.q;
          filter.gain.value = eqGainsRef.current[idx] ?? 0;
          return filter;
        });

        const node = ctx.createAnalyser();
        node.fftSize = 128;
        node.smoothingTimeConstant = 0.82;

        // Chain: source -> filter[0..4] -> analyser -> destination
        let prev: AudioNode = source;
        for (const filter of filters) {
          prev.connect(filter);
          prev = filter;
        }
        prev.connect(node);
        node.connect(ctx.destination);

        graph = { ctx, analyser: node, filters };
        audioGraphMap.set(audio, graph);
        setAnalyser(node);
      } catch {
        return null;
      }
    }

    if (graph.ctx.state === 'suspended') {
      graph.ctx.resume().catch(() => {});
    }
    return graph;
  }, []);

  const resolveTrackUrl = useCallback((track: Track): string | null => {
    if (track.audioUrl) return track.audioUrl;
    if (track.remoteUrl) return track.remoteUrl;
    if (track.synthPreset) {
      const url = getOrCreateSynthUrl(track.synthPreset);
      return url;
    }
    return null;
  }, []);

  // Load track source when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      loadedTrackIdRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (loadedTrackIdRef.current === currentTrack.id) {
      return;
    }

    const url = resolveTrackUrl(currentTrack);
    if (!url) return;

    loadedTrackIdRef.current = currentTrack.id;
    setAudioError(null);
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
    audio.src = url;
    audio.load();

    if (isPlaying) {
      ensureAudioGraph();
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrack, isPlaying, resolveTrackUrl, ensureAudioGraph]);

  // Pre-warm the first built-in track silently on mount + hydrate offline saved downloads
  useEffect(() => {
    if (SAMPLE_TRACKS[0]?.synthPreset) {
      getOrCreateSynthUrl(SAMPLE_TRACKS[0].synthPreset);
    }

    let active = true;
    const metas = loadSavedDownloadMeta();
    if (metas.length === 0) return;

    Promise.all(
      metas.map(async (meta): Promise<Track | null> => {
        if (!meta.cacheKey) return null;
        const blob = await loadCachedAudioBlob(meta.cacheKey);
        if (!blob) return null;
        const objectUrl = URL.createObjectURL(blob);
        blobByTrackIdRef.current.set(meta.id, blob);
        return { ...meta, audioUrl: objectUrl };
      })
    ).then((hydrated) => {
      if (!active) return;
      const valid = hydrated.filter((t): t is Track => t !== null);
      setSavedDownloads(valid);
    });

    return () => {
      active = false;
    };
  }, []);

  // Automatically fetch online lyrics in the background for tracks without bundled lyrics
  useEffect(() => {
    if (
      !currentTrack ||
      (currentTrack.lyrics && currentTrack.lyrics.length > 0) ||
      prefetchedLyricsIdsRef.current.has(currentTrack.id)
    ) {
      return;
    }

    prefetchedLyricsIdsRef.current.add(currentTrack.id);
    const controller = new AbortController();

    fetchOnlineLyrics(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration,
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result && result.lyrics.length > 0) {
          setTracks((prev) =>
            prev.map((t) =>
              t.id === currentTrack.id ? { ...t, lyrics: result.lyrics } : t
            )
          );
        }
      })
      .catch(() => {
        // Silent background fallback; LyricsPanel offers interactive retry
      });

    return () => {
      controller.abort();
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.duration, currentTrack?.lyrics]);

  // Sync volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync EQ gains to BiquadFilterNodes smoothly
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const graph = audioGraphMap.get(audio);
    if (!graph) return;

    graph.filters.forEach((filter, idx) => {
      const targetGain = eqGains[idx] ?? 0;
      filter.gain.setTargetAtTime(targetGain, graph.ctx.currentTime, 0.015);
    });
  }, [eqGains]);

  const setEqBandGain = useCallback((bandIndex: number, gain: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(gain * 2) / 2));
    setEqGains((prev) => {
      const next: EqGains = [...prev] as EqGains;
      next[bandIndex] = clamped;
      return next;
    });
    setEqPreset('custom');
  }, []);

  const applyEqPreset = useCallback(
    (presetId: EqPresetId) => {
      const found =
        EQ_PRESETS.find((p) => p.id === presetId) ??
        customEqPresets.find((p) => p.id === presetId);
      if (!found) return;
      setEqGains([...found.gains] as EqGains);
      setEqPreset(presetId);
    },
    [customEqPresets]
  );

  const saveCustomEqPreset = useCallback(
    (name: string) => {
      const cleanName = name.trim().slice(0, 28);
      if (!cleanName) return;

      const newPreset: EqPreset = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: cleanName,
        gains: [...eqGains] as EqGains,
        isCustom: true,
      };

      setCustomEqPresets((prev) => {
        const next = [...prev, newPreset];
        try {
          window.localStorage.setItem(
            CUSTOM_EQ_STORAGE_KEY,
            JSON.stringify(next)
          );
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
      setEqPreset(newPreset.id);
    },
    [eqGains]
  );

  const deleteCustomEqPreset = useCallback(
    (presetId: string) => {
      setCustomEqPresets((prev) => {
        const next = prev.filter((p) => p.id !== presetId);
        try {
          window.localStorage.setItem(
            CUSTOM_EQ_STORAGE_KEY,
            JSON.stringify(next)
          );
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
      setEqPreset((prev) => (prev === presetId ? 'custom' : prev));
    },
    []
  );

  const resetEq = useCallback(() => {
    setEqGains([0, 0, 0, 0, 0]);
    setEqPreset('flat');
  }, []);

  const getNextTrackId = useCallback(
    (direction: 'next' | 'prev'): string | null => {
      if (tracks.length === 0) return null;
      if (tracks.length === 1) return tracks[0].id;

      const currentIdx = tracks.findIndex((t) => t.id === currentTrack?.id);
      if (currentIdx === -1) return tracks[0].id;

      if (shuffle && direction === 'next') {
        const candidates = tracks.filter((t) => t.id !== currentTrack?.id);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick.id;
      }

      if (direction === 'next') {
        return tracks[(currentIdx + 1) % tracks.length].id;
      }
      return tracks[(currentIdx - 1 + tracks.length) % tracks.length].id;
    },
    [tracks, currentTrack?.id, shuffle]
  );

  const playTrack = useCallback(
    (trackId: string) => {
      const target = tracks.find((t) => t.id === trackId);
      if (!target || !audioRef.current) return;

      ensureAudioGraph();
      setAudioError(null);

      if (target.id === currentTrack?.id && loadedTrackIdRef.current === target.id) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
        return;
      }

      setCurrentTrackId(target.id);
      setIsPlaying(true);
    },
    [tracks, currentTrack?.id, ensureAudioGraph]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      ensureAudioGraph();
      if (loadedTrackIdRef.current !== currentTrack.id) {
        const url = resolveTrackUrl(currentTrack);
        if (url) {
          loadedTrackIdRef.current = currentTrack.id;
          audio.src = url;
          audio.load();
        }
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [currentTrack, isPlaying, ensureAudioGraph, resolveTrackUrl]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const nextId = getNextTrackId('next');
    if (nextId) {
      loadedTrackIdRef.current = null;
      setCurrentTrackId(nextId);
      setIsPlaying(true);
      ensureAudioGraph();
    }
  }, [tracks.length, getNextTrackId, ensureAudioGraph]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;

    // If past 3 seconds, restart current track first
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const prevId = getNextTrackId('prev');
    if (prevId) {
      loadedTrackIdRef.current = null;
      setCurrentTrackId(prevId);
      setIsPlaying(true);
      ensureAudioGraph();
    }
  }, [tracks.length, getNextTrackId, ensureAudioGraph]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(time, audio.duration || duration || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) =>
      prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
    );
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const updateVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // Attach HTMLAudioElement listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        const activeId = loadedTrackIdRef.current;
        if (activeId) {
          setTracks((prev) =>
            prev.map((t) =>
              t.id === activeId && t.duration === 0
                ? { ...t, duration: audio.duration }
                : t
            )
          );
        }
      }
    };

    const onEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }

      const currentIdx = tracks.findIndex((t) => t.id === currentTrack?.id);
      const isLastTrack = currentIdx === tracks.length - 1;

      if (repeatMode === 'off' && isLastTrack && !shuffle) {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
        return;
      }

      const nextId = getNextTrackId('next');
      if (nextId) {
        loadedTrackIdRef.current = null;
        setCurrentTrackId(nextId);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    };

    const onError = () => {
      setIsPlaying(false);
      setAudioError('Unable to decode this audio file.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [repeatMode, tracks, currentTrack?.id, shuffle, getNextTrackId]);

  const addLocalAudioItems = useCallback(
    (
      items: Array<{ file: File; lyricsText?: string; albumName?: string }>,
      options?: { playFirst?: boolean }
    ) => {
      const validItems = items.filter(
        ({ file }) =>
          file.type.startsWith('audio/') ||
          /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(file.name)
      );
      if (validItems.length === 0) return 0;

      const existingTracks = tracksRef.current;
      const toAppend: Track[] = [];
      const lyricsUpdates = new Map<string, LyricLine[]>();
      let firstTargetId: string | null = null;

      validItems.forEach(({ file, lyricsText, albumName }, idx) => {
        const { title, artist } = parseAudioFilename(file.name);
        const parsedLyrics = lyricsText
          ? parseLyricsInput(lyricsText)
          : undefined;

        const match = existingTracks.find(
          (t) =>
            t.source === 'local' &&
            t.title.toLowerCase() === title.toLowerCase() &&
            t.artist.toLowerCase() === artist.toLowerCase()
        );

        if (match) {
          if (!firstTargetId) firstTargetId = match.id;
          if (parsedLyrics && parsedLyrics.length > 0 && !match.lyrics?.length) {
            lyricsUpdates.set(match.id, parsedLyrics);
          }
          return;
        }

        const objectUrl = URL.createObjectURL(file);
        const id = `local-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
        if (!firstTargetId) firstTargetId = id;
        blobByTrackIdRef.current.set(id, file);

        const probe = new Audio();
        probe.preload = 'metadata';
        probe.src = objectUrl;
        probe.onloadedmetadata = () => {
          if (Number.isFinite(probe.duration) && probe.duration > 0) {
            setTracks((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, duration: probe.duration } : t
              )
            );
          }
        };

        toAppend.push({
          id,
          title,
          artist,
          album: albumName?.trim() || 'Local Folder',
          duration: 0,
          audioUrl: objectUrl,
          source: 'local',
          lyrics:
            parsedLyrics && parsedLyrics.length > 0 ? parsedLyrics : undefined,
        });
      });

      if (toAppend.length > 0 || lyricsUpdates.size > 0) {
        setTracks((prev) => {
          const updated =
            lyricsUpdates.size > 0
              ? prev.map((t) => {
                  const lyr = lyricsUpdates.get(t.id);
                  return lyr ? { ...t, lyrics: lyr } : t;
                })
              : prev;
          return [...updated, ...toAppend];
        });
      }

      if (firstTargetId && (options?.playFirst || !currentTrack)) {
        if (firstTargetId === currentTrack?.id && audioRef.current) {
          ensureAudioGraph();
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          loadedTrackIdRef.current = null;
          setCurrentTrackId(firstTargetId);
          setIsPlaying(true);
          ensureAudioGraph();
        }
      }

      return toAppend.length;
    },
    [currentTrack, ensureAudioGraph]
  );

  const addLocalFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      return addLocalAudioItems(
        files.map((file) => ({ file, albumName: 'Local Library' }))
      );
    },
    [addLocalAudioItems]
  );

  const playOrQueueRemoteTrack = useCallback(
    (result: RemoteAudioResult, options?: { playNow?: boolean }): Track => {
      const existing = tracksRef.current.find(
        (t) =>
          t.id === result.id ||
          (t.remoteUrl && t.remoteUrl === result.streamUrl)
      );
      const cached = savedDownloadsRef.current.find((d) => d.id === result.id);

      const targetTrack: Track =
        existing ??
        cached ?? {
          id: result.id,
          title: result.title,
          artist: result.artist,
          album: result.album,
          duration: result.duration,
          artworkUrl: result.artworkUrl,
          audioUrl: result.streamUrl,
          remoteUrl: result.streamUrl,
          source: 'remote',
          isPreview: result.isPreview,
        };

      if (!existing) {
        setTracks((prev) => [...prev, targetTrack]);
      }

      if (options?.playNow || !currentTrack) {
        if (targetTrack.id === currentTrack?.id && audioRef.current) {
          ensureAudioGraph();
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          loadedTrackIdRef.current = null;
          setCurrentTrackId(targetTrack.id);
          setIsPlaying(true);
          ensureAudioGraph();
        }
      }

      return targetTrack;
    },
    [currentTrack, ensureAudioGraph]
  );

  const saveDownloadedAudio = useCallback(
    async (result: RemoteAudioResult, blob: Blob): Promise<Track> => {
      const cacheKey = `dl-${result.id}`;
      await saveCachedAudioBlob(cacheKey, blob);
      const objectUrl = URL.createObjectURL(blob);
      blobByTrackIdRef.current.set(result.id, blob);

      const resolvedExt: 'mp3' | 'm4a' = blob.type
        .toLowerCase()
        .includes('mpeg')
        ? 'mp3'
        : result.fileExt;

      const savedTrack: Track = {
        id: result.id,
        title: result.title,
        artist: result.artist,
        album: result.album,
        duration: result.duration,
        artworkUrl: result.artworkUrl,
        audioUrl: objectUrl,
        remoteUrl: result.streamUrl,
        cacheKey,
        source: 'local',
        isPreview: result.isPreview,
        fileExt: resolvedExt,
      };

      setSavedDownloads((prev) => {
        const filtered = prev.filter((t) => t.id !== savedTrack.id);
        const next = [savedTrack, ...filtered];
        saveDownloadMeta(next);
        return next;
      });

      setTracks((prev) =>
        prev.map((t) =>
          t.id === savedTrack.id
            ? {
                ...t,
                audioUrl: objectUrl,
                cacheKey,
                source: 'local',
                fileExt: resolvedExt,
              }
            : t
        )
      );

      return savedTrack;
    },
    []
  );

  const playSavedDownload = useCallback(
    (saved: Track, options?: { playNow?: boolean }) => {
      const existing = tracksRef.current.find((t) => t.id === saved.id);
      if (!existing) {
        setTracks((prev) => [...prev, saved]);
      }
      if (options?.playNow !== false) {
        if (saved.id === currentTrack?.id && audioRef.current) {
          ensureAudioGraph();
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          loadedTrackIdRef.current = null;
          setCurrentTrackId(saved.id);
          setIsPlaying(true);
          ensureAudioGraph();
        }
      }
    },
    [currentTrack?.id, ensureAudioGraph]
  );

  const deleteSavedDownload = useCallback(async (trackId: string) => {
    const target = savedDownloadsRef.current.find((t) => t.id === trackId);
    if (target?.cacheKey) {
      await deleteCachedAudioBlob(target.cacheKey);
    }
    setSavedDownloads((prev) => {
      const next = prev.filter((t) => t.id !== trackId);
      saveDownloadMeta(next);
      return next;
    });
  }, []);

  const prepareTrackForPlaylist = useCallback(
    async (track: Track): Promise<Track> => {
      if (track.cacheKey || track.synthPreset || track.remoteUrl) {
        return track;
      }
      const blob = blobByTrackIdRef.current.get(track.id);
      if (blob) {
        const cacheKey = `pl-local-${track.id}`;
        const ok = await saveCachedAudioBlob(cacheKey, blob);
        if (ok) {
          return { ...track, cacheKey };
        }
      }
      return track;
    },
    []
  );

  const loadPlaylistTracks = useCallback(
    async (
      playlistTracks: Track[],
      options?: { replaceQueue?: boolean; playFirst?: boolean }
    ) => {
      if (playlistTracks.length === 0) return;

      const hydrated = await Promise.all(
        playlistTracks.map(async (t): Promise<Track> => {
          if (t.synthPreset || t.remoteUrl) {
            return t;
          }
          const inMemory = tracksRef.current.find((cur) => cur.id === t.id);
          if (inMemory?.audioUrl) {
            return { ...t, audioUrl: inMemory.audioUrl };
          }
          if (t.cacheKey) {
            const blob = await loadCachedAudioBlob(t.cacheKey);
            if (blob) {
              const url = URL.createObjectURL(blob);
              blobByTrackIdRef.current.set(t.id, blob);
              return { ...t, audioUrl: url };
            }
          }
          return t;
        })
      );

      if (options?.replaceQueue) {
        loadedTrackIdRef.current = null;
        setTracks(hydrated);
        if (options?.playFirst !== false && hydrated[0]) {
          setCurrentTrackId(hydrated[0].id);
          setIsPlaying(true);
          ensureAudioGraph();
        }
      } else {
        setTracks((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = hydrated.filter((h) => !existingIds.has(h.id));
          return [...prev, ...fresh];
        });
        if (options?.playFirst && hydrated[0]) {
          loadedTrackIdRef.current = null;
          setCurrentTrackId(hydrated[0].id);
          setIsPlaying(true);
          ensureAudioGraph();
        }
      }
    },
    [ensureAudioGraph]
  );

  const removeTrack = useCallback(
    (trackId: string) => {
      setTracks((prev) => {
        const target = prev.find((t) => t.id === trackId);
        const keptInDownloads = savedDownloadsRef.current.some(
          (d) => d.id === trackId
        );
        if (
          target?.source === 'local' &&
          target.audioUrl &&
          target.audioUrl.startsWith('blob:') &&
          !keptInDownloads
        ) {
          URL.revokeObjectURL(target.audioUrl);
        }

        const nextList = prev.filter((t) => t.id !== trackId);

        if (trackId === currentTrack?.id) {
          loadedTrackIdRef.current = null;
          if (nextList.length > 0) {
            const oldIndex = prev.findIndex((t) => t.id === trackId);
            const fallback = nextList[Math.min(oldIndex, nextList.length - 1)];
            setCurrentTrackId(fallback.id);
          } else {
            setCurrentTrackId(null);
            setIsPlaying(false);
          }
        }
        return nextList;
      });
    },
    [currentTrack?.id]
  );

  const restoreSampleTracks = useCallback(() => {
    setTracks((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const missing = SAMPLE_TRACKS.filter((t) => !existingIds.has(t.id));
      const merged = [...missing, ...prev];
      if (!currentTrack && merged.length > 0) {
        setCurrentTrackId(merged[0].id);
      }
      return merged;
    });
  }, [currentTrack]);

  const updateTrackLyrics = useCallback(
    (trackId: string, lyrics: LyricLine[]) => {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, lyrics } : t))
      );
    },
    []
  );

  return {
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
  };
}
