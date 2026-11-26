import { Mp3Encoder } from '@breezystack/lamejs';
import { RemoteAudioResult } from '../types/music';

const AUDIUS_BASE = 'https://api.audius.co/v1';
const APP_NAME = 'HypeBoom';

export type DownloadFormat = 'mp3' | 'original';

interface AudiusRawTrack {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  play_count?: number;
  favorite_count?: number;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  stream_conditions?: unknown;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  user?: {
    name?: string;
  };
}

interface ItunesRawTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  previewUrl?: string;
}

interface ScoredCandidate {
  result: RemoteAudioResult;
  score: number;
}

function getValidAudiusArtwork(artwork?: AudiusRawTrack['artwork']): string | null {
  const candidate =
    artwork?.['480x480'] || artwork?.['1000x1000'] || artwork?.['150x150'];
  if (!candidate || !candidate.startsWith('http')) return null;
  return candidate;
}

function mapAudiusCandidate(item: AudiusRawTrack): ScoredCandidate | null {
  if (
    !item.id ||
    !item.title ||
    item.is_streamable === false ||
    item.is_stream_gated ||
    item.stream_conditions
  ) {
    return null;
  }

  const artworkUrl = getValidAudiusArtwork(item.artwork);
  if (!artworkUrl) {
    return null;
  }

  const duration =
    typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0
      ? item.duration
      : 0;

  // Exclude broken micro-clips (< 20s)
  if (duration > 0 && duration < 20) {
    return null;
  }

  const streamUrl = `${AUDIUS_BASE}/tracks/${encodeURIComponent(
    item.id
  )}/stream?app_name=${APP_NAME}`;

  const plays = typeof item.play_count === 'number' ? item.play_count : 0;
  const favorites = typeof item.favorite_count === 'number' ? item.favorite_count : 0;
  const hasHighResArt = Boolean(
    item.artwork?.['480x480'] || item.artwork?.['1000x1000']
  );
  const isStandardSongLength = duration >= 45 && duration <= 600;

  const score =
    plays +
    favorites * 5 +
    (hasHighResArt ? 1500 : 0) +
    (isStandardSongLength ? 25000 : 0);

  return {
    score,
    result: {
      id: `audius-${item.id}`,
      title: item.title.trim(),
      artist: item.user?.name?.trim() || 'Independent Artist',
      album: item.genre?.trim() || 'Audius Catalog',
      duration,
      artworkUrl,
      streamUrl,
      downloadUrl: streamUrl,
      fileExt: 'mp3',
      catalog: 'audius',
      isPreview: false,
    },
  };
}

async function probeStreamHealth(
  streamUrl: string,
  outerSignal?: AbortSignal
): Promise<'ok' | 'dead' | 'network'> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2600);
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });

  try {
    const res = await fetch(streamUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      signal: controller.signal,
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // Cancel reading the rest of the stream immediately
    res.body?.cancel().catch(() => {});

    if (!res.ok) {
      return 'dead';
    }
    if (
      contentType.includes('application/json') ||
      contentType.startsWith('text/')
    ) {
      return 'dead';
    }
    return 'ok';
  } catch {
    return outerSignal?.aborted ? 'dead' : 'network';
  } finally {
    window.clearTimeout(timeout);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}

async function curateAudiusResults(
  rawList: AudiusRawTrack[],
  signal?: AbortSignal
): Promise<RemoteAudioResult[]> {
  const mapped = rawList
    .map(mapAudiusCandidate)
    .filter((item): item is ScoredCandidate => item !== null);

  if (mapped.length === 0) return [];

  // Prefer crisp song-length tracks (45s - 10m) before falling back to longer sets
  const standardSongs = mapped.filter(
    ({ result }) => result.duration >= 45 && result.duration <= 600
  );
  const mediumPool = mapped.filter(
    ({ result }) => result.duration >= 25 && result.duration <= 1200
  );

  const selectedPool =
    standardSongs.length >= 4
      ? standardSongs
      : mediumPool.length >= 2
      ? mediumPool
      : mapped;

  const ranked = [...selectedPool]
    .sort((a, b) => b.score - a.score)
    .slice(0, 18)
    .map((item) => item.result);

  // Probe stream health concurrently so broken 404 entries never appear
  const statuses = await Promise.all(
    ranked.map((track) => probeStreamHealth(track.streamUrl, signal))
  );

  if (signal?.aborted) return [];

  const verified = ranked.filter((_, idx) => statuses[idx] === 'ok');
  if (verified.length > 0) {
    return verified.slice(0, 15);
  }

  // If probes timed out due to network throttling rather than HTTP 404s,
  // still return non-dead candidates so search stays usable.
  return ranked.filter((_, idx) => statuses[idx] !== 'dead').slice(0, 12);
}

export async function fetchTrendingAudiusTracks(
  signal?: AbortSignal
): Promise<RemoteAudioResult[]> {
  const res = await fetch(
    `${AUDIUS_BASE}/tracks/trending?app_name=${APP_NAME}&limit=40`,
    { signal }
  );
  if (!res.ok) {
    throw new Error('Could not reach Audius trending catalog.');
  }
  const json = (await res.json()) as { data?: AudiusRawTrack[] };
  return curateAudiusResults(json.data ?? [], signal);
}

export async function searchAudiusTracks(
  query: string,
  signal?: AbortSignal
): Promise<RemoteAudioResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return fetchTrendingAudiusTracks(signal);
  }
  const res = await fetch(
    `${AUDIUS_BASE}/tracks/search?query=${encodeURIComponent(
      trimmed
    )}&app_name=${APP_NAME}&limit=40`,
    { signal }
  );
  if (!res.ok) {
    throw new Error('Audio search request failed.');
  }
  const json = (await res.json()) as { data?: AudiusRawTrack[] };
  return curateAudiusResults(json.data ?? [], signal);
}

export async function searchItunesPreviews(
  query: string,
  signal?: AbortSignal
): Promise<RemoteAudioResult[]> {
  const trimmed = query.trim() || 'top hits';
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      trimmed
    )}&media=music&entity=song&limit=25`,
    { signal }
  );
  if (!res.ok) {
    throw new Error('Preview catalog search failed.');
  }
  const json = (await res.json()) as { results?: ItunesRawTrack[] };
  return (json.results ?? [])
    .filter(
      (item) =>
        Boolean(
          item.trackId &&
            item.trackName &&
            item.previewUrl &&
            item.artworkUrl100 &&
            item.artworkUrl100.startsWith('http')
        )
    )
    .map((item) => {
      const highResArt = item.artworkUrl100!.replace('100x100bb', '400x400bb');
      return {
        id: `itunes-${item.trackId}`,
        title: item.trackName!.trim(),
        artist: item.artistName?.trim() || 'Unknown Artist',
        album: item.collectionName?.trim() || 'Music Preview',
        duration: 30,
        artworkUrl: highResArt,
        streamUrl: item.previewUrl!,
        downloadUrl: item.previewUrl!,
        fileExt: 'm4a' as const,
        catalog: 'itunes' as const,
        isPreview: true,
      };
    });
}

export function sanitizeAudioFilename(
  artist: string,
  title: string,
  ext: string
): string {
  const clean = `${artist} - ${title}`
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `${clean || 'HypeBoom-Audio'}.${ext}`;
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export async function convertAudioBlobToMp3(sourceBlob: Blob): Promise<Blob> {
  if (sourceBlob.type.toLowerCase().includes('mpeg')) {
    return sourceBlob;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Audio conversion is unavailable in this browser.');
  }

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const channels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new Mp3Encoder(channels, sampleRate, 192);

    const leftPcm = floatTo16BitPcm(audioBuffer.getChannelData(0));
    const rightPcm =
      channels > 1 ? floatTo16BitPcm(audioBuffer.getChannelData(1)) : undefined;

    const mp3Parts: ArrayBuffer[] = [];
    const blockSize = 1152;

    for (let i = 0; i < leftPcm.length; i += blockSize) {
      const leftChunk = leftPcm.subarray(i, i + blockSize);
      const rightChunk = rightPcm?.subarray(i, i + blockSize);
      const encoded = rightChunk
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk);
      if (encoded.length > 0) {
        const copy = new Uint8Array(encoded.length);
        copy.set(encoded);
        mp3Parts.push(copy.buffer);
      }
    }

    const tail = encoder.flush();
    if (tail.length > 0) {
      const tailCopy = new Uint8Array(tail.length);
      tailCopy.set(tail);
      mp3Parts.push(tailCopy.buffer);
    }

    return new Blob(mp3Parts, { type: 'audio/mpeg' });
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function downloadRemoteAudioBlob(
  result: RemoteAudioResult,
  format: DownloadFormat = 'mp3',
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string; fileExt: 'mp3' | 'm4a' }> {
  const res = await fetch(result.downloadUrl, { signal });
  if (!res.ok) {
    throw new Error('Unable to download audio file.');
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json') || contentType.startsWith('text/')) {
    throw new Error('Audio stream is unavailable from source.');
  }

  const rawBlob = await res.blob();
  if (rawBlob.size < 4096) {
    throw new Error('Downloaded audio file was empty or incomplete.');
  }

  if (format === 'mp3') {
    if (result.fileExt === 'mp3' || contentType.includes('audio/mpeg')) {
      const mp3Blob =
        rawBlob.type === 'audio/mpeg'
          ? rawBlob
          : new Blob([rawBlob], { type: 'audio/mpeg' });
      return {
        blob: mp3Blob,
        fileExt: 'mp3',
        filename: sanitizeAudioFilename(result.artist, result.title, 'mp3'),
      };
    }

    // Transcode M4A / AAC preview into genuine MP3 so default downloads are always .mp3
    try {
      const mp3Blob = await convertAudioBlobToMp3(rawBlob);
      return {
        blob: mp3Blob,
        fileExt: 'mp3',
        filename: sanitizeAudioFilename(result.artist, result.title, 'mp3'),
      };
    } catch {
      // Safe fallback to original container if browser audio decoder refuses codec
    }
  }

  return {
    blob: rawBlob,
    fileExt: result.fileExt,
    filename: sanitizeAudioFilename(result.artist, result.title, result.fileExt),
  };
}
