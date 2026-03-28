import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BACKOFFICE_URL = process.env.TEST_BACKOFFICE_URL ?? 'http://localhost:5173';
const OPERATOR_URL = process.env.TEST_OPERATOR_URL ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './tests',
  // All tests in a file run in order; no test-level parallelism to avoid auth races
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? ([['github']] as ['github'][][]) : []),
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  projects: [
    {
      name: 'backoffice',
      testMatch: '**/backoffice/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BACKOFFICE_URL,
        storageState: 'playwright/.auth/backoffice.json',
      },
    },
    {
      name: 'operator',
      testMatch: '**/operator/**/*.spec.ts',
      use: {
        ...devices['Mobile Chrome'],
        baseURL: OPERATOR_URL,
      },
    },
  ],
});
