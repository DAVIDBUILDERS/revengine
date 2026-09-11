import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    reducedMotion: "reduce",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @david/preview dev",
      url: "http://localhost:3002",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @david/web dev",
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DAVID_MODE: "fixture",
        DAVID_DEPLOYMENT: "local",
        DAVID_LIVE_EXECUTION: "false",
        APP_ORIGIN: "http://localhost:3000",
      },
    },
    {
      command: "pnpm --filter @david/demo dev",
      url: "http://localhost:3001",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
