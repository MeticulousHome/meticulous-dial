import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/shot-graph',
  testMatch: '**/*.spec.ts',
  outputDir: process.env.SHOT_GRAPH_TEST_OUTPUT || 'test-results/shot-graph',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:1435',
    viewport: { width: 480, height: 480 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    }
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --config tests/shot-graph/vite.config.ts',
    url: 'http://127.0.0.1:1435',
    reuseExistingServer: false
  }
});
