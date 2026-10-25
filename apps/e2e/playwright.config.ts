import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'screenshots',
      testDir: 'screenshots',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env['SCREENSHOTS_BASE_URL'] ?? 'http://localhost:4200',
      },
    },
  ],
});
