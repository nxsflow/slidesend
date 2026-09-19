import { defineConfig, devices } from "@playwright/test";

/** Local mode: no platform, stage and desk coupled in one browser. */
export const localPort = 5199;
/** Hosted mode on the dev bridge's in-memory platform, with a known control secret. */
export const hostedPort = 5198;
export const hostedSecret = "e2e-control-secret";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${localPort}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `pnpm dev --port ${localPort} --strictPort`,
      url: `http://localhost:${localPort}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm dev --port ${hostedPort} --strictPort`,
      url: `http://localhost:${hostedPort}`,
      reuseExistingServer: !process.env.CI,
      env: { VITE_SLIDESEND_PLATFORM: "dev", SLIDESEND_DEV_SECRET: hostedSecret },
    },
  ],
});
