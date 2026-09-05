import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  // A booking flow crosses several network round trips and a serializable transaction, so
  // a single retry on CI distinguishes a real regression from runner contention. Locally
  // a failure should stay a failure.
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }], ["list"]] : [["list"]],
  // The browser suite drives a development server, which compiles routes on first request.
  // A cold compile under CI contention can exceed the default action timeout, which shows
  // up as an unrelated-looking click failure.
  timeout: isCI ? 90_000 : 30_000,
  expect: { timeout: isCI ? 15_000 : 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: isCI ? 20_000 : 0,
    navigationTimeout: isCI ? 30_000 : 0,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Deliberately the development server, not `next start`. A production build sets
        // NODE_ENV=production, which disables the development payment simulator by design,
        // and the booking suite needs to complete a payment without opening Razorpay.
        // CI runs `next build` separately so build failures are still caught.
        command: "npx next dev --hostname 127.0.0.1 --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          ENABLE_DEV_PAYMENT: "true",
          PAYMENT_PROVIDER: "dev",
        },
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
