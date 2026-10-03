import { defineConfig, devices } from "@playwright/test";

/** Local mode: no platform, stage and desk coupled in one browser. */
export const localPort = 5199;
/** Hosted mode on the dev bridge's in-memory platform, with a known control secret. */
export const hostedPort = 5198;
export const hostedSecret = "e2e-control-secret";
/** The AWS Blocks dev server with its local mocks, started by `slidesend dev`; Vite runs on +100. */
export const blocksPort = 3400;
/** The control secret the checks seed for the Blocks dev server; see e2e/global-setup.ts. */
export const blocksSecret = "e2e-blocks-secret";

export default defineConfig({
  testDir: "e2e",
  // One dev server means one set of sessions, and only one live session may be open at a time,
  // so the checks run one after another.
  fullyParallel: false,
  workers: 1,
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
    {
      // A fresh store for every run: a previous run's open live session would block a new one.
      // The control secret is seeded the way an AppSetting mock reads it, by its full id.
      command: [
        "rm -rf .bb-data .blocks-sandbox",
        "mkdir -p .bb-data",
        `printf '{"gravity-sd-control": "${blocksSecret}"}' > .bb-data/settings.json`,
        `node ../../packages/slidesend-core/dist/cli.js dev --port ${blocksPort}`,
      ].join(" && "),
      url: `http://localhost:${blocksPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      // The agent chat is off by default in the example; the hosted checks switch it on, so the
      // canned provider is exercised the way a talk would use it. The deck then has one step more.
      env: { VITE_SLIDESEND_AGENT: "1" },
    },
  ],
});
