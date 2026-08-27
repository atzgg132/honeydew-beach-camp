import { expect, test } from "@playwright/test";
import path from "node:path";

const routes = [
  "/",
  "/rooms",
  "/rooms/single-bed",
  "/rooms/double-bed",
  "/book",
  "/manage-booking",
  "/gallery",
  "/amenities",
  "/about",
  "/contact",
  "/policies",
];

const viewports = [
  { name: "320", width: 320, height: 720 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

test.describe("visual qa screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const viewport of viewports) {
    test(`captures ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        await page.goto(route, { waitUntil: "networkidle" });
        const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
        await page.screenshot({
          path: path.join("e2e", "screenshots", `${slug}-${viewport.name}.png`),
          fullPage: true,
        });
        await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
      }
    });
  }
});
