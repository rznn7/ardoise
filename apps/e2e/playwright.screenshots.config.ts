import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'screenshots',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env['SCREENSHOTS_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
});
