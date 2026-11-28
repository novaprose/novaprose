import { withGuidepup } from '@guidepup/playwright';
import { devices } from '@playwright/test';

/**
 * VoiceOver reading the playground editor in WebKit: what a blind user on a Mac hears. macOS only,
 * VoiceOver takes over the keyboard and speaks: it runs in CI on a macOS runner
 * (.github/workflows/screen-reader.yml). withGuidepup runs the tests one at a time in a visible window.
 */
export default withGuidepup({
  testDir: '.',
  testMatch: 'voiceover.spec.ts',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  // VoiceOver sometimes doesn't start on the first try on a fresh macOS runner.
  retries: process.env.CI ? 2 : 0,
  timeout: 3 * 60 * 1000,
  reportSlowTests: null,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }],
  webServer: {
    command: 'pnpm --filter @novaprose/playground exec vite --port 5173 --strictPort --open false',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
