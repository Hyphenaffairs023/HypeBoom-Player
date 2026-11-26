import { SynthPresetId } from '../types/music';

const SAMPLE_RATE = 22050;
const synthUrlCache = new Map<SynthPresetId, string>();

interface PresetConfig {
  bpm: number;
  bars: number;
  chords: number[][];
  melodyPattern: number[];
  bassPattern: number[];
  toneWarmth: number;
  percussionLevel: number;
  arpeggioSpeed: number;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const PRESETS: Record<SynthPresetId, PresetConfig> = {
  kyoto_rain: {
    bpm: 78,
    bars: 12,
    // Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    chords: [
      [53, 57, 60, 64, 69],
      [52, 55, 59, 62, 67],
      [50, 53, 57, 60, 65],
      [48, 52, 55, 59, 64],
    ],
    melodyPattern: [69, 72, 76, 74, 72, 67, 69, 71],
    bassPattern: [41, 40, 38, 36],
    toneWarmth: 0.42,
    percussionLevel: 0.14,
    arpeggioSpeed: 2,
  },
  glass_horizon: {
    bpm: 66,
    bars: 12,
    // Am9 -> Fmaj7 -> Cmaj9 -> G6
    chords: [
      [57, 60, 64, 67, 71],
      [53, 57, 60, 64, 69],
      [48, 55, 59, 62, 64],
      [55, 59, 62, 64, 67],
    ],
    melodyPattern: [76, 72, 71, 69, 72, 74, 76, 79],
    bassPattern: [45, 41, 36, 43],
    toneWarmth: 0.35,
    percussionLevel: 0.04,
    arpeggioSpeed: 1,
  },
  midnight_tram: {
    bpm: 88,
    bars: 16,
    // Dm9 -> G13 -> Cmaj9 -> A7sus4
    chords: [
      [50, 53, 57, 60, 64],
      [55, 59, 62, 64, 69],
      [48, 52, 55, 59, 62],
      [45, 50, 52, 55, 60],
    ],
    melodyPattern: [64, 67, 69, 72, 71, 67, 64, 62],
    bassPattern: [38, 43, 36, 45],
    toneWarmth: 0.55,
    percussionLevel: 0.18,
    arpeggioSpeed: 2,
  },
  sunlit_courtyard: {
    bpm: 94,
    bars: 16,
    // Dmaj7 -> A6 -> Bm7 -> Gmaj7
    chords: [
      [50, 54, 57, 61, 66],
      [45, 49, 52, 54, 61],
      [47, 50, 54, 57, 62],
      [43, 47, 50, 54, 59],
    ],
    melodyPattern: [74, 73, 69, 66, 69, 73, 74, 78],
    bassPattern: [38, 45, 47, 43],
    toneWarmth: 0.62,
    percussionLevel: 0.11,
    arpeggioSpeed: 4,
  },
  static_stars: {
    bpm: 72,
    bars: 12,
    // Cm9 -> Abmaj7 -> Ebmaj7 -> Bb6
    chords: [
      [48, 55, 58, 62, 63],
      [44, 51, 55, 58, 60],
      [51, 55, 58, 62, 67],
      [46, 50, 53, 55, 62],
    ],
    melodyPattern: [67, 70, 72, 75, 74, 70, 67, 63],
    bassPattern: [36, 32, 39, 34],
    toneWarmth: 0.48,
    percussionLevel: 0.09,
    arpeggioSpeed: 3,
  },
};

export function getPresetDuration(presetId: SynthPresetId): number {
  const cfg = PRESETS[presetId];
  const beatDur = 60 / cfg.bpm;
  return Math.round(cfg.bars * 4 * beatDur);
}

function encodeWavStereo(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const length = left.length;
  const buffer = new ArrayBuffer(44 + length * 4);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 4, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); // Byte rate
  view.setUint16(32, 4, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * 4, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function renderPresetToWavBlob(presetId: SynthPresetId): Blob {
  const cfg = PRESETS[presetId];
  const beatDur = 60 / cfg.bpm;
  const barDur = beatDur * 4;
  const totalDur = cfg.bars * barDur;
  const totalSamples = Math.floor(totalDur * SAMPLE_RATE);

  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Deterministic pseudo-random for gentle vinyl/brush noise
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  // Precompute chord frequencies
  const chordFreqs = cfg.chords.map((chord) => chord.map(midiToFreq));
  const bassFreqs = cfg.bassPattern.map(midiToFreq);
  const melodyFreqs = cfg.melodyPattern.map(midiToFreq);

  let lpLeft = 0;
  let lpRight = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const barFloat = t / barDur;
    const barIdx = Math.floor(barFloat);
    const barLocalTime = t - barIdx * barDur;
    const barProgress = barLocalTime / barDur;

    const chordIdx = barIdx % chordFreqs.length;
    const chord = chordFreqs[chordIdx];
    const bassFreq = bassFreqs[chordIdx];

    // Pad / Rhodes chord envelope per bar
    const padAttack = Math.min(1, barLocalTime / 0.14);
    const padRelease = Math.min(1, (barDur - barLocalTime) / 0.35);
    const padEnv = padAttack * padRelease;

    let padL = 0;
    let padR = 0;
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n];
      const phase = 2 * Math.PI * f * t;
      // Warm Rhodes-like harmonic spectrum (fundamental + gentle 2nd & 3rd)
      const bell = Math.exp(-barLocalTime * 1.4) * 0.25;
      const sample =
        Math.sin(phase) * 0.65 +
        Math.sin(phase * 2) * (0.18 + bell * cfg.toneWarmth) +
        Math.sin(phase * 3) * (0.05 * cfg.toneWarmth);

      // Subtle stereo spread across chord voices
      const pan = (n / (chord.length - 1)) * 0.6 - 0.3;
      padL += sample * (0.5 - pan * 0.5);
      padR += sample * (0.5 + pan * 0.5);
    }
    padL = (padL / chord.length) * padEnv * 0.52;
    padR = (padR / chord.length) * padEnv * 0.52;

    // Warm sub bass (pulse on beat 1 and beat 3)
    const beatInBar = barLocalTime / beatDur;
    const subCycle = beatInBar % 2;
    const subTime = subCycle * beatDur;
    const bassEnv =
      Math.min(1, subTime / 0.04) * Math.exp(-subTime * 1.35);
    const bassPhase = 2 * Math.PI * bassFreq * t;
    const bassSample =
      (Math.sin(bassPhase) * 0.85 + Math.sin(bassPhase * 2) * 0.15) *
      bassEnv *
      0.32;

    // Gentle melodic arpeggio / felt piano plucks
    const stepDur = beatDur / cfg.arpeggioSpeed;
    const stepIdx = Math.floor(t / stepDur);
    const stepTime = t - stepIdx * stepDur;
    const noteIndex = (stepIdx + barIdx) % melodyFreqs.length;
    // Rest occasionally for breathing room
    const restMask = (stepIdx + barIdx) % 5 === 4 ? 0 : 1;
    const melFreq = melodyFreqs[noteIndex];
    const melEnv =
      Math.min(1, stepTime / 0.015) *
      Math.exp(-stepTime * (2.6 + cfg.arpeggioSpeed * 0.5)) *
      restMask;
    const melPhase = 2 * Math.PI * melFreq * t;
    const melSample =
      (Math.sin(melPhase) * 0.72 +
        Math.sin(melPhase * 2) * 0.2 * cfg.toneWarmth) *
      melEnv *
      0.24;

    // Stereo delay-like shimmer on melody
    const melPan = Math.sin(stepIdx * 0.9) * 0.35;
    const melL = melSample * (0.5 - melPan * 0.4);
    const melR = melSample * (0.5 + melPan * 0.4);

    // Subtle soft percussion / lo-fi kick & brush hat
    let perc = 0;
    if (cfg.percussionLevel > 0) {
      const beatIdx = Math.floor(t / beatDur);
      const beatTime = t - beatIdx * beatDur;
      // Soft kick on beats 0 and 2
      if (beatIdx % 2 === 0 && beatTime < 0.18) {
        const kickFreq = 48 + 75 * Math.exp(-beatTime * 32);
        const kickEnv = Math.exp(-beatTime * 16);
        perc += Math.sin(2 * Math.PI * kickFreq * beatTime) * kickEnv * 0.9;
      }
      // Gentle eighth-note brush shaker
      const eighthTime = t % (beatDur * 0.5);
      const brushEnv = Math.exp(-eighthTime * 38);
      perc += nextRand() * brushEnv * 0.18;
    }
    perc *= cfg.percussionLevel;

    // Gentle global vinyl texture
    const noise = nextRand() * 0.004;

    // Mix & soft one-pole lowpass warmth
    const rawL = padL + bassSample + melL + perc + noise;
    const rawR = padR + bassSample + melR + perc + noise;

    const cutoff = 0.38 + cfg.toneWarmth * 0.28;
    lpLeft += (rawL - lpLeft) * cutoff;
    lpRight += (rawR - lpRight) * cutoff;

    // Global fade-in / fade-out (0.6s) to prevent loop clicks
    const fadeIn = Math.min(1, t / 0.6);
    const fadeOut = Math.min(1, (totalDur - t) / 0.8);
    const masterEnv = fadeIn * fadeOut * (0.95 + 0.05 * Math.sin(barProgress * Math.PI));

    left[i] = Math.tanh(lpLeft * 1.35) * masterEnv;
    right[i] = Math.tanh(lpRight * 1.35) * masterEnv;
  }

  return encodeWavStereo(left, right, SAMPLE_RATE);
}

export function getOrCreateSynthUrl(presetId: SynthPresetId): string {
  const cached = synthUrlCache.get(presetId);
  if (cached) {
    return cached;
  }
  const blob = renderPresetToWavBlob(presetId);
  const url = URL.createObjectURL(blob);
  synthUrlCache.set(presetId, url);
  return url;
}
