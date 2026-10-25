import { type SKRSContext2D } from '@napi-rs/canvas';
import {
  type BackdropPaletteColors,
  type BackdropShape,
} from 'src/app/shared/ui/backdrop/backdrop-palettes';

import { type Rng } from './rng';

const RAY_COUNT = 60;
const GRAIN_AMPLITUDE = 26;
const HIGHLIGHT_PROBABILITY = 0.08;
const REFERENCE_WIDTH = 340;

type Point = readonly [number, number];

const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

function pickColor(rng: Rng, palette: BackdropPaletteColors): string {
  if (rng() < HIGHLIGHT_PROBABILITY) return palette.hi;
  return palette.rays[Math.floor(rng() * palette.rays.length)] ?? palette.hi;
}

function originFor(shape: BackdropShape, w: number, h: number, rng: Rng): Point {
  switch (shape) {
    case 'converge':
      return [w * between(rng, 0.4, 0.6), -h * between(rng, 0.5, 1.2)];
    case 'sunrise':
      return [w * between(rng, -0.1, 0.15), h * between(rng, 1.3, 1.8)];
    case 'diagonal':
      return [-4 * w, -6 * h];
  }
}

function rayEndFor(shape: BackdropShape, w: number, h: number, rng: Rng): Point {
  switch (shape) {
    case 'converge':
      return [between(rng, -0.6 * w, 1.6 * w), 1.1 * h];
    case 'sunrise': {
      const t = rng();
      return [1.2 * w * t - 0.1 * w, -0.2 * h - (1 - t) * 0.5 * h];
    }
    case 'diagonal': {
      const t = between(rng, -0.4, 1.4);
      return [w * t + 0.6 * h, 1.2 * h];
    }
  }
}

function drawRays(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  palette: BackdropPaletteColors,
  shape: BackdropShape,
  origin: Point,
  rng: Rng,
): void {
  const scale = w / REFERENCE_WIDTH;
  const reach = Math.hypot(w, h) * 8 * 0.2;
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < RAY_COUNT; i++) {
    const [ex, ey] = rayEndFor(shape, w, h, rng);
    const dx = ex - origin[0];
    const dy = ey - origin[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const endWidth = between(rng, 4, 70) * scale;
    const isDiagonal = shape === 'diagonal';
    const tipWidth = endWidth * (isDiagonal ? between(rng, 0.8, 1) : between(rng, 0.02, 0.15));
    const fx = isDiagonal ? ex - (dx / length) * reach : origin[0];
    const fy = isDiagonal ? ey - (dy / length) * reach : origin[1];

    ctx.filter = `blur(${String(between(rng, 0, 7) * scale)}px)`;
    ctx.globalAlpha = between(rng, 0.12, 0.6);
    ctx.fillStyle = pickColor(rng, palette);
    ctx.beginPath();
    ctx.moveTo(ex - (nx * endWidth) / 2, ey - (ny * endWidth) / 2);
    ctx.lineTo(ex + (nx * endWidth) / 2, ey + (ny * endWidth) / 2);
    ctx.lineTo(fx + (nx * tipWidth) / 2, fy + (ny * tipWidth) / 2);
    ctx.lineTo(fx - (nx * tipWidth) / 2, fy - (ny * tipWidth) / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.filter = 'none';
}

function drawGlow(ctx: SKRSContext2D, w: number, h: number, hi: string, origin: Point): void {
  const gx = Math.min(Math.max(origin[0], 0), w);
  const gy = Math.min(Math.max(origin[1], 0), h);
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.5);
  glow.addColorStop(0, hi);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function addGrain(ctx: SKRSContext2D, w: number, h: number, rng: Rng): void {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const noise = (rng() - 0.5) * GRAIN_AMPLITUDE * (0.7 + 0.6 * luminance);
    data[i] = r + noise;
    data[i + 1] = g + noise;
    data[i + 2] = b + noise;
  }
  ctx.putImageData(image, 0, 0);
}

export function renderBackdrop(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  palette: BackdropPaletteColors,
  shape: BackdropShape,
  rng: Rng,
): void {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, palette.base[0]);
  base.addColorStop(1, palette.base[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const origin = originFor(shape, w, h, rng);
  drawRays(ctx, w, h, palette, shape, origin, rng);
  drawGlow(ctx, w, h, palette.hi, origin);
  addGrain(ctx, w, h, rng);
}
