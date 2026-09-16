import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure"
  },
  webServer: {
    env: { ADMIN_USERNAME: "e2e-admin", ADMIN_PASSWORD: "e2e-only-password-2026", ADMIN_SESSION_SECRET: "e2e-only-session-secret-32-characters-long" },
    command: "DATABASE_URL=file:./e2e.db NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100 npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
