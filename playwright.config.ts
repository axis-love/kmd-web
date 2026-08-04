import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for kmd-web visual baseline tests.
 *
 * Browser matrix: Chromium, Firefox, WebKit
 * Viewport matrix: desktop 1280x720, narrow 375x667
 * Theme matrix: light, dark
 *
 * Tests consume the built dist artifacts (npm run build) — NOT source
 * imports. The visual test harness loads CSS from @axis-love/styles and
 * uses @axis-love/core's render() to produce safe HTML.
 *
 * Reduced motion: the test context emulates prefers-reduced-motion: reduce
 * to prevent animation-induced snapshot flakiness.
 */

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "./test-results/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",

  use: {
    // Emulate reduced motion to prevent animation flakiness in snapshots.
    reducedMotion: "reduce",
    // Screenshot clip to the viewport — deterministic captures.
    screenshot: "only-on-failure",
    // Artifacts
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "chromium-narrow",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "firefox-narrow",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "webkit-desktop",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "webkit-narrow",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
});
