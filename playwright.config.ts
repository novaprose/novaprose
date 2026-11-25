import { defineConfig, devices } from '@playwright/test';

/**
 * Браузерные e2e-тесты против playground. Проверяют то, чего не видит jsdom:
 * реальный ввод, выделение, горячие клавиши, вставку, раскладку тулбара.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @novaprose/playground exec vite --port 5173 --strictPort --open false',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Сервер синхронизации для collab.html: режим разработки, документы только в памяти.
      command: 'node apps/sync-server/src/server.mjs --dev',
      url: 'http://localhost:1234/health',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '1234', NOVA_SYNC_DB: ':memory:' },
    },
  ],
});
