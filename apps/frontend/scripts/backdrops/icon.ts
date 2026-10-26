import { createRequire } from 'node:module';

import { type Canvas, createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { BACKDROP_PALETTES } from 'src/app/shared/ui/backdrop/backdrop-palettes';

import { renderBackdrop } from './render';
import { hashString, mulberry32 } from './rng';

const BACKDROP_WIDTH = 860;
const BACKDROP_HEIGHT = 1864;
const CROP_VERTICAL_BIAS = 0.3;
const FONT_FAMILY = 'Figtree Icon';
const FONT_WEIGHT = 500;
const WORD = 'ardoise';
const HALO_STOPS: readonly (readonly [number, string])[] = [
  [0, 'rgba(0, 0, 0, 0.38)'],
  [0.55, 'rgba(0, 0, 0, 0.12)'],
  [0.8, 'rgba(0, 0, 0, 0)'],
];

const fontPath = createRequire(import.meta.url).resolve(
  '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2',
);
GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);

function renderSourceBackdrop(): Canvas {
  const canvas = createCanvas(BACKDROP_WIDTH, BACKDROP_HEIGHT);
  renderBackdrop(
    canvas.getContext('2d'),
    BACKDROP_WIDTH,
    BACKDROP_HEIGHT,
    BACKDROP_PALETTES.violet,
    'sunrise',
    mulberry32(hashString('violet-sunrise-1')),
  );
  return canvas;
}

export async function renderAppIcon(size: number, textSpan: number): Promise<Buffer> {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const cropTop = (BACKDROP_HEIGHT - BACKDROP_WIDTH) * CROP_VERTICAL_BIAS;
  ctx.drawImage(
    renderSourceBackdrop(),
    0,
    cropTop,
    BACKDROP_WIDTH,
    BACKDROP_WIDTH,
    0,
    0,
    size,
    size,
  );

  const centre = size / 2;
  const halo = ctx.createRadialGradient(centre, centre, 0, centre, centre, size * Math.SQRT1_2);
  for (const [offset, color] of HALO_STOPS) halo.addColorStop(offset, color);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.font = `${String(FONT_WEIGHT)} 100px '${FONT_FAMILY}'`;
  const ink = ctx.measureText(WORD);
  const inkWidth = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const inkHeight = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
  const scale = (textSpan * size) / Math.max(inkWidth, inkHeight);
  const inkCentreX = (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2;
  const inkCentreY = (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2;

  ctx.translate(centre - inkCentreX * scale, centre - inkCentreY * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(WORD, 0, 0);

  return canvas.encode('png');
}
