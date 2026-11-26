import { ThemeId } from '../types/music';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  isDark: boolean;
  swatchColor: string;
  accentColor: string;
  accentTextColor: string;
  accentFgColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    isDark: false,
    swatchColor: '#F4F4F1',
    accentColor: '#E85A2A',
    accentTextColor: '#C9461A',
    accentFgColor: '#FFFFFF',
  },
  {
    id: 'dark',
    label: 'Dark',
    isDark: true,
    swatchColor: '#101114',
    accentColor: '#E85A2A',
    accentTextColor: '#E85A2A',
    accentFgColor: '#FFFFFF',
  },
  {
    id: 'graphite',
    label: 'Matte Graphite',
    isDark: true,
    swatchColor: '#2E333D',
    accentColor: '#CBD5E1',
    accentTextColor: '#E2E8F0',
    accentFgColor: '#181B20',
  },
  {
    id: 'rose',
    label: 'Pink Rose',
    isDark: false,
    swatchColor: '#F472B6',
    accentColor: '#DB2777',
    accentTextColor: '#BE185D',
    accentFgColor: '#FFFFFF',
  },
  {
    id: 'lemon',
    label: 'Lemon',
    isDark: false,
    swatchColor: '#FACC15',
    accentColor: '#EAB308',
    accentTextColor: '#A16207',
    accentFgColor: '#1A1A0E',
  },
  {
    id: 'sky',
    label: 'Sky Blue',
    isDark: false,
    swatchColor: '#38BDF8',
    accentColor: '#0284C7',
    accentTextColor: '#0369A1',
    accentFgColor: '#FFFFFF',
  },
];
