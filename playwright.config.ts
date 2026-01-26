import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:9847',
  },
  webServer: {
    command: 'AGENTTRAIL_CONFIG=tests/e2e/fixtures/config.json bun run start',
    url: 'http://localhost:9847',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
