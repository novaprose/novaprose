import { defineConfig, devices } from '@playwright/test';

/**
 * Замеры скорости (pnpm perf): по одному тесту за раз и только в Chromium — параллельные прогоны
 * и разные движки дали бы шум вместо цифр. Нужна сборка (pnpm build): замеряем CDN-файл.
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
