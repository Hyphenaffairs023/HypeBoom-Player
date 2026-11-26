export type RepeatMode = 'off' | 'all' | 'one';

export type ThemeId =
  | 'dark'
  | 'light'
  | 'graphite'
  | 'rose'
  | 'lemon'
  | 'sky';

export type VisualizerStyle = 'bar' | 'wave' | 'circular';

export type StageView = 'artwork' | 'visualizer' | 'lyrics' | 'eq';

export type LowerStageMode = 'artwork' | 'visualizer' | 'lyrics';

export type EqGains = [number, number, number, number, number];

export type EqPresetId = string;

export interface EqPreset {
  id: string;
  label: string;
  gains: EqGains;
  isCustom?: boolean;
}

export type TrackSource = 'builtin' | 'local' | 'remote';

export type LibraryFilter = 'all' | 'builtin' | 'local' | 'remote';

export type SynthPresetId =
  | 'kyoto_rain'
  | 'glass_horizon'
  | 'midnight_tram'
  | 'sunlit_courtyard'
  | 'static_stars';

export interface LyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl?: string;
  audioUrl?: string;
  remoteUrl?: string;
  cacheKey?: string;
  source: TrackSource;
  synthPreset?: SynthPresetId;
  bpm?: number;
  lyrics?: LyricLine[];
  isPreview?: boolean;
  fileExt?: 'mp3' | 'm4a';
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface RemoteAudioResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl?: string;
  streamUrl: string;
  downloadUrl: string;
  fileExt: 'mp3' | 'm4a';
  catalog: 'audius' | 'itunes';
  isPreview?: boolean;
}

export type RightPanelTab = 'queue' | 'playlists' | 'discover' | 'folders';

export interface FolderEntry {
  kind: 'directory' | 'file';
  name: string;
  path: string[];
  size?: number;
  dirHandle?: FileSystemDirectoryHandle;
  fileHandle?: FileSystemFileHandle;
  file?: File;
  lrcFileHandle?: FileSystemFileHandle;
  lrcFile?: File;
}
