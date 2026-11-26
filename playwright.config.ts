import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e tests against the playground. They check what jsdom can't see:
 * real typing, selection, keyboard shortcuts, paste, toolbar layout.
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
      // Sync server for collab.html: development mode, documents only in memory.
      command: 'node apps/sync-server/src/server.mjs --dev',
      url: 'http://localhost:1234/health',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '1234', NOVA_SYNC_DB: ':memory:' },
    },
  ],
});
