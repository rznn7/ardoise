import {
  type Backdrop,
  BACKDROP_SEEDS,
  BACKDROP_SHAPES,
  type BackdropPalette,
} from './backdrop-palettes';

const PALETTE_ORDER: readonly BackdropPalette[] = ['violet', 'cobalt', 'sunset', 'ember'];

const mod = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

const hash = (value: number): number => Math.imul(value ^ 0x9e3779b9, 0x85ebca6b) >>> 0;

const pick = <T>(items: readonly T[], index: number): T => {
  const item = items[mod(index, items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
};

export function backdropFor(groupId: number): Backdrop {
  const h = hash(groupId);
  return {
    palette: pick(PALETTE_ORDER, groupId),
    shape: pick(BACKDROP_SHAPES, h),
    seed: pick(BACKDROP_SEEDS, h >>> 8),
  };
}

export const backdropUrl = ({ palette, shape, seed }: Backdrop): string =>
  `/backdrops/${palette}-${shape}-${String(seed)}.webp`;
