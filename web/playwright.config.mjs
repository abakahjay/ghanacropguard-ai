import { defineConfig, devices } from "@playwright/test";

/*
  End-to-end tests against a running stack:
    backend  : FullBackendd `node app.js` on :7004 (any model bundle in CROPGUARD_MODEL_DIR,
               e.g. its test/cropguard/tiny-model)
    web      : npm run build && npm run preview  (VITE_API_URL=http://localhost:7004)
  Run: npx playwright test
  Set E2E_BASE_URL to test another deployment; set PW_CHROMIUM to use a specific browser binary.
*/
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./e2e/.results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } },
    },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
});
