import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a production build of the app against a real Postgres
 * database. See e2e/README.md for how to run them.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_BASE_URL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://dnd:dnd@localhost:5432/dnd_planner_e2e";

export default defineConfig({
  testDir: "./e2e",
  // Every spec file resets and reseeds the one shared database, so specs run
  // one at a time, in a single worker.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1100, height: 900 },
    timezoneId: "Europe/Oslo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "app", testIgnore: /security\.spec\.ts/ },
    // The security spec deliberately locks accounts out of signing in. The
    // lockout lives in the server's memory, so it runs last, after the rest.
    { name: "security", testMatch: /security\.spec\.ts/, dependencies: ["app"] },
  ],
  webServer: {
    // Uses the existing production build: run `npm run build` first.
    command: `npx prisma migrate deploy && npx next start -p ${PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NEXTAUTH_URL: E2E_BASE_URL,
      NEXTAUTH_SECRET: "e2e-test-secret-not-for-production",
      TZ: "Europe/Oslo",
    },
  },
});
