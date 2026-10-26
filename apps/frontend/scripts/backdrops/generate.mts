import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';
import {
  BACKDROP_PALETTES,
  BACKDROP_SEEDS,
  BACKDROP_SHAPES,
  type BackdropPalette,
} from 'src/app/shared/ui/backdrop/backdrop-palettes';

import { renderAppIcon } from './icon';
import { renderBackdrop } from './render';
import { hashString, mulberry32 } from './rng';

const WIDTH = 860;
const HEIGHT = 1864;
const WEBP_QUALITY = 82;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = resolve(root, 'public/backdrops');
const tokensFile = resolve(root, 'src/styles/backdrop-tokens.css');
const iconsDir = resolve(root, 'public/icons');

const APP_ICONS: readonly { file: string; size: number; textSpan: number }[] = [
  { file: 'apple-touch-icon.png', size: 180, textSpan: 0.8 },
  { file: 'icon-192.png', size: 192, textSpan: 0.8 },
  { file: 'icon-512.png', size: 512, textSpan: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, textSpan: 0.56 },
  { file: 'favicon-48.png', size: 48, textSpan: 0.8 },
];

const palettes = Object.keys(BACKDROP_PALETTES) as BackdropPalette[];

async function generateImages(): Promise<void> {
  mkdirSync(outputDir, { recursive: true });
  for (const palette of palettes) {
    for (const shape of BACKDROP_SHAPES) {
      for (const seed of BACKDROP_SEEDS) {
        const canvas = createCanvas(WIDTH, HEIGHT);
        const rng = mulberry32(hashString(`${palette}-${shape}-${String(seed)}`));
        renderBackdrop(
          canvas.getContext('2d'),
          WIDTH,
          HEIGHT,
          BACKDROP_PALETTES[palette],
          shape,
          rng,
        );
        const file = resolve(outputDir, `${palette}-${shape}-${String(seed)}.webp`);
        writeFileSync(file, await canvas.encode('webp', WEBP_QUALITY));
        console.log(`wrote ${file}`);
      }
    }
  }
}

function generateTokens(): void {
  const lines = palettes.map(
    (palette) => `  --backdrop-${palette}: ${BACKDROP_PALETTES[palette].base[0]};`,
  );
  mkdirSync(dirname(tokensFile), { recursive: true });
  writeFileSync(tokensFile, `:root {\n${lines.join('\n')}\n}\n`);
  console.log(`wrote ${tokensFile}`);
}

async function generateIcons(): Promise<void> {
  mkdirSync(iconsDir, { recursive: true });
  for (const { file, size, textSpan } of APP_ICONS) {
    const target = resolve(iconsDir, file);
    writeFileSync(target, await renderAppIcon(size, textSpan));
    console.log(`wrote ${target}`);
  }
}

await generateImages();
generateTokens();
await generateIcons();
