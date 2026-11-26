import { useEffect, useRef } from 'react';
import { VisualizerStyle } from '../types/music';

export interface VisualizerPalette {
  id: string;
  name: string;
  colors: [string, string, string];
}

export const VISUALIZER_PALETTES: VisualizerPalette[] = [
  {
    id: 'ember',
    name: 'Ember',
    colors: ['#E85A2A', '#F59E0B', '#FB7185'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0EA5E9', '#14B8A6', '#6366F1'],
  },
  {
    id: 'prism',
    name: 'Prism',
    colors: ['#F43F5E', '#F59E0B', '#06B6D4'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    colors: ['#10B981', '#06B6D4', '#8B5CF6'],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    colors: ['#EC4899', '#8B5CF6', '#3B82F6'],
  },
];

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  isDark: boolean;
  style: VisualizerStyle;
  palette: VisualizerPalette;
  compact?: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function samplePaletteColor(
  colors: [string, string, string],
  t: number,
  alpha = 1
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (colors.length - 1);
  const idx = Math.min(colors.length - 2, Math.floor(scaled));
  const frac = scaled - idx;

  const [r1, g1, b1] = hexToRgb(colors[idx]);
  const [r2, g2, b2] = hexToRgb(colors[idx + 1]);

  const r = Math.round(r1 + (r2 - r1) * frac);
  const g = Math.round(g1 + (g2 - g1) * frac);
  const b = Math.round(b1 + (b2 - b1) * frac);

  return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
}

export function AudioVisualizer({
  analyser,
  isPlaying,
  isDark,
  style,
  palette,
  compact = false,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let phaseShift = 0;
    const barCount = compact ? 12 : 36;
    const radialCount = compact ? 24 : 64;
    const smoothedBars = new Float32Array(barCount);
    const peakBars = new Float32Array(barCount);
    const smoothedRadial = new Float32Array(radialCount);

    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const timeData = analyser ? new Uint8Array(analyser.fftSize) : null;

    const gridColor = isDark
      ? 'rgba(255, 255, 255, 0.06)'
      : 'rgba(20, 21, 24, 0.06)';
    const idleColor = isDark
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(20, 21, 24, 0.16)';

    const drawBars = (width: number, height: number) => {
      const padX = compact ? 8 : Math.max(16, width * 0.08);
      const padY = compact ? 10 : Math.max(20, height * 0.12);
      const usableW = width - padX * 2;
      const maxHalfH = (height - padY * 2) / 2;
      const midY = height / 2;

      // Subtle studio centerline
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, midY);
      ctx.lineTo(width - padX, midY);
      ctx.stroke();

      const gap = compact ? 2 : 4;
      const barWidth = Math.max(2, (usableW - gap * (barCount - 1)) / barCount);

      for (let i = 0; i < barCount; i++) {
        let target = 0.04;
        if (isPlaying && freqData && !prefersReducedMotion) {
          const binIndex = Math.min(
            freqData.length - 1,
            Math.floor((i / barCount) * Math.min(48, freqData.length))
          );
          target = Math.max(0.05, freqData[binIndex] / 255);
        } else if (isPlaying && prefersReducedMotion) {
          target = 0.35;
        }

        smoothedBars[i] += (target - smoothedBars[i]) * 0.24;
        if (smoothedBars[i] > peakBars[i]) {
          peakBars[i] = smoothedBars[i];
        } else {
          peakBars[i] = Math.max(smoothedBars[i], peakBars[i] - 0.008);
        }

        const halfH = Math.max(compact ? 2 : 3, smoothedBars[i] * maxHalfH);
        const x = padX + i * (barWidth + gap);
        const y = midY - halfH;

        const colorPos = (i / (barCount - 1) + phaseShift) % 1;
        const activeColor = samplePaletteColor(palette.colors, colorPos);

        ctx.fillStyle =
          isPlaying && smoothedBars[i] > 0.12 ? activeColor : idleColor;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, halfH * 2, barWidth / 2);
        ctx.fill();

        if (!compact && isPlaying && peakBars[i] > 0.16) {
          const peakOffset = peakBars[i] * maxHalfH + 4;
          ctx.fillStyle = samplePaletteColor(palette.colors, colorPos, 0.55);
          ctx.fillRect(x, midY - peakOffset, barWidth, 1.5);
          ctx.fillRect(x, midY + peakOffset - 1.5, barWidth, 1.5);
        }
      }
    };

    const drawWave = (width: number, height: number) => {
      const padX = compact ? 6 : Math.max(16, width * 0.07);
      const usableW = width - padX * 2;
      const midY = height / 2;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const lines = compact ? [0.5] : [0.25, 0.5, 0.75];
      for (const frac of lines) {
        const gy = height * frac;
        ctx.beginPath();
        ctx.moveTo(padX, gy);
        ctx.lineTo(width - padX, gy);
        ctx.stroke();
      }

      const samples = compact ? 32 : 72;
      const points: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < samples; i++) {
        const x = padX + (i / (samples - 1)) * usableW;
        let offset = 0;

        if (isPlaying && timeData && !prefersReducedMotion) {
          const idx = Math.min(
            timeData.length - 1,
            Math.floor((i / (samples - 1)) * (timeData.length - 1))
          );
          const normalized = (timeData[idx] - 128) / 128;
          offset = normalized * (height * 0.42);
        } else if (isPlaying && prefersReducedMotion) {
          offset = Math.sin((i / samples) * Math.PI * 4) * (height * 0.14);
        }

        const margin = compact ? 6 : 16;
        const y = Math.max(margin, Math.min(height - margin, midY + offset));
        points.push({ x, y });
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midPtY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midPtY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);

      const waveGradient = ctx.createLinearGradient(padX, 0, width - padX, 0);
      const c0 = samplePaletteColor(palette.colors, phaseShift % 1);
      const c1 = samplePaletteColor(palette.colors, (0.5 + phaseShift) % 1);
      const c2 = samplePaletteColor(palette.colors, (0.95 + phaseShift) % 1);
      waveGradient.addColorStop(0, c0);
      waveGradient.addColorStop(0.5, c1);
      waveGradient.addColorStop(1, c2);

      ctx.strokeStyle = isPlaying ? waveGradient : idleColor;
      ctx.lineWidth = compact ? 2 : 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (isPlaying) {
        const fillGradient = ctx.createLinearGradient(padX, 0, width - padX, 0);
        fillGradient.addColorStop(
          0,
          samplePaletteColor(palette.colors, phaseShift % 1, 0.14)
        );
        fillGradient.addColorStop(
          0.5,
          samplePaletteColor(palette.colors, (0.5 + phaseShift) % 1, 0.14)
        );
        fillGradient.addColorStop(
          1,
          samplePaletteColor(palette.colors, (0.95 + phaseShift) % 1, 0.14)
        );

        ctx.lineTo(last.x, midY);
        ctx.lineTo(points[0].x, midY);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();
      }
    };

    const drawCircular = (width: number, height: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const minDim = Math.min(width, height);
      const baseRadius = minDim * 0.22;
      const maxRay = minDim * 0.19;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + maxRay, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(20, 21, 24, 0.12)';
      ctx.lineWidth = compact ? 1 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, baseRadius - 2), 0, Math.PI * 2);
      ctx.stroke();

      let energySum = 0;

      for (let i = 0; i < radialCount; i++) {
        let target = 0.06;
        if (isPlaying && freqData && !prefersReducedMotion) {
          const half = radialCount / 2;
          const mirroredIdx = i < half ? i : radialCount - 1 - i;
          const binIndex = Math.min(
            freqData.length - 1,
            Math.floor((mirroredIdx / half) * Math.min(44, freqData.length))
          );
          target = Math.max(0.07, freqData[binIndex] / 255);
        } else if (isPlaying && prefersReducedMotion) {
          target = 0.35;
        }

        smoothedRadial[i] += (target - smoothedRadial[i]) * 0.24;
        energySum += smoothedRadial[i];

        const rayLength = Math.max(compact ? 2 : 4, smoothedRadial[i] * maxRay);
        const angle = (i / radialCount) * Math.PI * 2 - Math.PI / 2;

        const x1 = cx + Math.cos(angle) * baseRadius;
        const y1 = cy + Math.sin(angle) * baseRadius;
        const x2 = cx + Math.cos(angle) * (baseRadius + rayLength);
        const y2 = cy + Math.sin(angle) * (baseRadius + rayLength);

        const colorPos = (i / radialCount + phaseShift) % 1;
        ctx.strokeStyle =
          isPlaying && smoothedRadial[i] > 0.14
            ? samplePaletteColor(palette.colors, colorPos)
            : idleColor;
        ctx.lineWidth = compact ? 1.5 : 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      if (!compact) {
        const avgEnergy = energySum / radialCount;
        ctx.strokeStyle = isPlaying
          ? samplePaletteColor(palette.colors, (0.5 + phaseShift) % 1, 0.5)
          : gridColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          Math.max(8, baseRadius * (0.45 + avgEnergy * 0.4)),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      if (isPlaying && !prefersReducedMotion) {
        phaseShift = (phaseShift + 0.0015) % 1;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying && !prefersReducedMotion) {
        if (style === 'wave' && timeData) {
          analyser.getByteTimeDomainData(timeData);
        } else if (freqData) {
          analyser.getByteFrequencyData(freqData);
        }
      }

      if (style === 'wave') {
        drawWave(width, height);
      } else if (style === 'circular') {
        drawCircular(width, height);
      } else {
        drawBars(width, height);
      }

      ctx.restore();

      if (isPlaying && !prefersReducedMotion) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [analyser, isPlaying, isDark, style, palette, compact]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full block"
    />
  );
}
