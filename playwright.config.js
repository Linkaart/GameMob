import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm start',
    env: { PORT: '3100', HOST: '127.0.0.1', DATA_DIR: 'test-results/profile-data' },
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
