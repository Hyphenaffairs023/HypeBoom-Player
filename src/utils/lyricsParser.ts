import { LyricLine } from '../types/music';

const LRC_TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

export function parseLyricsInput(raw: string, fallbackDuration = 180): LyricLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const timedLines: LyricLine[] = [];
  const plainLines: string[] = [];

  for (const line of lines) {
    const matches = [...line.matchAll(LRC_TIMESTAMP_RE)];
    if (matches.length > 0) {
      const text = line.replace(LRC_TIMESTAMP_RE, '').trim();
      if (!text) continue;
      for (const m of matches) {
        const mins = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        const msStr = (m[3] || '0').padEnd(3, '0').slice(0, 3);
        const ms = parseInt(msStr, 10) / 1000;
        timedLines.push({ time: mins * 60 + secs + ms, text });
      }
    } else if (!/^\[[a-zA-Z]+:.*\]$/.test(line)) {
      plainLines.push(line);
    }
  }

  if (timedLines.length > 0) {
    return timedLines.sort((a, b) => a.time - b.time);
  }

  const safeDur = fallbackDuration > 10 ? fallbackDuration : 60;
  const step = safeDur / Math.max(1, plainLines.length);
  return plainLines.map((text, idx) => ({
    time: Math.round(idx * step * 10) / 10,
    text,
  }));
}
