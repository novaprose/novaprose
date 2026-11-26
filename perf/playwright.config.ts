import { defineConfig, devices } from '@playwright/test';

/**
 * Speed measurements (pnpm perf): one test at a time and only in Chromium: parallel runs
 * and different engines would give noise instead of numbers. Needs a build (pnpm build): the CDN file is measured.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.perf.ts',
  globalSetup: './setup.ts',
  globalTeardown: './report.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
