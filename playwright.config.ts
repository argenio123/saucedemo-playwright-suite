import { defineConfig, devices } from '@playwright/test';

/**
 * SauceDemo regression suite.
 *
 *   npm test                 run everything
 *   npm run test:headed      watch it in a visible browser
 *   npm run test:cart        one spec only
 *
 * Do not pass --reporter= on the command line: it replaces the list below and
 * the TC-numbered case report will not be written.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // SauceDemo holds no shared server-side state, so tests are safe in parallel.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 1,

  // Guards against a stray test.only reaching CI.
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['json', { outputFile: 'results/report.json' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
    // Writes results/case-results.json and .csv, keyed by TC number.
    ['./utils/case-reporter.ts'],
    // Pushes the run to Testomat.io when TESTOMATIO is set; silent otherwise.
    ...(process.env.TESTOMATIO
      ? [['@testomatio/reporter/lib/adapter/playwright.js', { apiKey: process.env.TESTOMATIO }] as const]
      : []),
  ],

  use: {
    baseURL: 'https://www.saucedemo.com',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable after: npx playwright install firefox webkit
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],
});
