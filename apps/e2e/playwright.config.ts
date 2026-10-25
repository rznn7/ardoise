import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4300',
    viewport: { width: 393, height: 852 },
    trace: 'retain-on-failure',
  },
});
