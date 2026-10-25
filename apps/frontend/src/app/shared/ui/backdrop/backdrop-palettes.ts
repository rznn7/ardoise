export type BackdropPalette = 'violet' | 'cobalt' | 'sunset' | 'ember';
export type BackdropShape = 'converge' | 'sunrise' | 'diagonal';
export type BackdropSeed = (typeof BACKDROP_SEEDS)[number];

export interface BackdropPaletteColors {
  base: readonly [string, string];
  rays: readonly string[];
  hi: string;
}

export interface Backdrop {
  palette: BackdropPalette;
  shape: BackdropShape;
  seed: BackdropSeed;
}

export const BACKDROP_SHAPES: readonly BackdropShape[] = ['converge', 'sunrise', 'diagonal'];
export const BACKDROP_SEEDS = [1, 2] as const;

export const BACKDROP_PALETTES: Record<BackdropPalette, BackdropPaletteColors> = {
  violet: {
    base: ['#16005a', '#3a0bb8'],
    rays: ['#7b2cff', '#a52cff', '#5a1aff', '#e040ff', '#4a10e0'],
    hi: '#7fe9ff',
  },
  cobalt: {
    base: ['#020a3a', '#0a2a9a'],
    rays: ['#1f4dff', '#2f7bff', '#0f2fd0', '#4aa8ff', '#1838e8'],
    hi: '#8ff5ff',
  },
  sunset: {
    base: ['#2a0a2e', '#5a1440'],
    rays: ['#ff5a5f', '#ff8a4a', '#ffb547', '#d93a7a', '#ff6f91'],
    hi: '#ffe7a8',
  },
  ember: {
    base: ['#0d0605', '#2a0c06'],
    rays: ['#ff4a1c', '#ff7a1c', '#d92a10', '#ffa53a', '#b0200c'],
    hi: '#ffe0a0',
  },
};
