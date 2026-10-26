import { resolve } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    root: './',
  },
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
      scripts: resolve(__dirname, 'scripts'),
      '@ardoise/shared': resolve(__dirname, '../../libs/shared/src/index.ts'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
