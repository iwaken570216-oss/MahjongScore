import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  projects: [
    {
      name: "iPhone",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "Android",
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4173/MahjongScore/",
    ...devices["iPhone 13"],
    browserName: "chromium",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/MahjongScore/",
    reuseExistingServer: false,
  },
});
