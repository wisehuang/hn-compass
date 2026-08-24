import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  webServer: {
    command: "pnpm exec next dev --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    env: { E2E_FIXTURE: "1" },
  },
  use: {
    baseURL: "http://127.0.0.1:3001",
  },
});
