import { withGuidepup } from '@guidepup/playwright';
import { devices } from '@playwright/test';

/**
 * NVDA reading the playground editor: what a blind user hears after a shortcut or a Markdown shortcut.
 * Windows only, NVDA takes over the keyboard and speaks: it runs in CI (.github/workflows/screen-reader.yml).
 * withGuidepup runs the tests one at a time in a visible browser window.
 */
export default withGuidepup({
  testDir: '.',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 3 * 60 * 1000,
  reportSlowTests: null,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @novaprose/playground exec vite --port 5173 --strictPort --open false',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
