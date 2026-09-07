import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/scale-overlay',
  testMatch: '**/*.spec.ts',
  outputDir: process.env.SCALE_TEST_OUTPUT || 'test-results/scale-overlay',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:1434',
    viewport: { width: 480, height: 480 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    video: 'on',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    }
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --config tests/scale-overlay/vite.config.ts',
    url: 'http://127.0.0.1:1434',
    reuseExistingServer: false
  }
});
