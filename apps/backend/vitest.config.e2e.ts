import { resolve } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    root: './',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage/e2e',
    },
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
