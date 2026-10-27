import { resolve } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    root: './',
    coverage: {
      provider: 'v8',
      include: ['src/**/domain/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/domain/*-repository.ts',
        'src/auth/domain/passkey-verifier.ts',
        'src/auth/domain/unit-of-work.ts',
      ],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage/unit',
    },
  },
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
      '@ardoise/shared': resolve(__dirname, '../../libs/shared/src/index.ts'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
