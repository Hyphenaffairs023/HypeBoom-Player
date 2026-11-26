import { EqPreset } from '../types/music';

export interface EqBandConfig {
  frequency: number;
  label: string;
  type: BiquadFilterType;
  q: number;
}

export const EQ_BANDS: EqBandConfig[] = [
  { frequency: 60, label: '60Hz', type: 'lowshelf', q: 0.7 },
  { frequency: 230, label: '230Hz', type: 'peaking', q: 1.0 },
  { frequency: 910, label: '910Hz', type: 'peaking', q: 1.0 },
  { frequency: 3600, label: '3.6k', type: 'peaking', q: 1.0 },
  { frequency: 14000, label: '14k', type: 'highshelf', q: 0.7 },
];

export const EQ_PRESETS: EqPreset[] = [
  {
    id: 'flat',
    label: 'Flat',
    gains: [0, 0, 0, 0, 0],
  },
  {
    id: 'bass_boost',
    label: 'Bass Boost',
    gains: [6.5, 4.0, 0, -1.0, 0.5],
  },
  {
    id: 'acoustic',
    label: 'Acoustic',
    gains: [2.5, 1.5, 1.0, 3.0, 3.5],
  },
  {
    id: 'vocal',
    label: 'Vocal',
    gains: [-2.0, -1.0, 4.5, 5.0, 1.5],
  },
  {
    id: 'late_night',
    label: 'Late Night',
    gains: [3.0, 1.5, -1.0, 1.5, -2.5],
  },
];
