import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.sync.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174/MahjongScore/",
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command:
      "npm run build -- --outDir dist-sync-test && npm run preview -- --outDir dist-sync-test --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/MahjongScore/",
    env: {
      VITE_SUPABASE_URL: "https://sync-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_for_local_tests",
    },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
