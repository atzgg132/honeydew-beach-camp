import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { addDays, todayIstDate } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

const backendConfigured = Boolean(process.env.DATABASE_URL);
const email = "e2e.admin@honeydew.example";
const password = "e2e-admin-password";

function stay(offset: number) {
  const checkIn = addDays(todayIstDate(), offset);
  return { checkIn, checkOut: addDays(checkIn, 1) };
}

async function fillDate(page: Page, label: string, value: string) {
  await page.getByLabel(label).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function ensureAdmin() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash: await hashPassword(password), acceptedAt: new Date(), disabledAt: null },
      });
      return;
    }
    await prisma.adminUser.create({
      data: { email, passwordHash: await hashPassword(password), acceptedAt: new Date() },
    });
  } finally {
    await prisma.rateLimitBucket.deleteMany();
    await prisma.$disconnect();
  }
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
}

test.describe("admin desk", () => {
  test("login page is public and unknown sessions redirect", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "Staff desk" })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("signed-in staff can open the desk", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    await signIn(page);
    await expect(page.getByRole("navigation", { name: "Desk" }).getByRole("link", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Desk" }).getByRole("link", { name: "New", exact: true })).toHaveCount(0);
    await page.goto("/admin/bookings");
    await expect(page.getByRole("heading", { name: "Bookings", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "New booking" })).toBeVisible();
    await page.goto("/admin/bookings/new");
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();
    await page.getByRole("button", { name: "Walk-in" }).click();
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("heading", { name: "Arrangement" })).toBeVisible();
  });

  test("creates a walk-in and shows the assigned room", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    await signIn(page);
    const { checkIn, checkOut } = stay(test.info().project.name === "mobile" ? 52 : 48);
    await page.goto("/admin/bookings/new");
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();
    await fillDate(page, "Check-in", checkIn);
    await fillDate(page, "Check-out", checkOut);
    await page.getByRole("button", { name: "Decrease Adults" }).click();
    await page.getByRole("button", { name: "Walk-in" }).click();
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("heading", { name: "Arrangement" })).toBeVisible();
    await page.locator("section").filter({ hasText: "Arrangement" }).getByRole("button").first().click();
    await expect(page.getByText(/Stay total/)).toBeVisible();
    await page.getByLabel("Name").fill("Walk In Guest");
    await page.getByLabel("Phone").fill("9876500444");
    await page.getByLabel("Email").fill("walkin.e2e@honeydew.example");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Walk In Guest" })).toBeVisible();
    await expect(page.getByText(/Single-Bed Room · Non-AC · 40[1-7]/)).toBeVisible();
  });

  test("blocking a room drops public availability", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    const { checkIn, checkOut } = stay(80 + (Date.now() % 180) + (test.info().project.name === "mobile" ? 200 : 0));
    const roomNumber = test.info().project.name === "mobile" ? "402" : "401";
    const before = await page.request.post("/api/availability/search", {
      data: { checkIn, checkOut, composition: { adults: 1, childrenUnder5: 0, children5to10: 0 } },
    });
    expect(before.ok()).toBe(true);
    const beforeBody = (await before.json()) as { data?: { availability?: { "single-bed": number } } };
    const starting = beforeBody.data?.availability?.["single-bed"] ?? 0;
    expect(starting).toBeGreaterThan(0);

    await signIn(page);
    await page.goto("/admin/rooms");
    await expect(page.getByRole("heading", { name: "Rooms", exact: true })).toBeVisible();
    await page.getByLabel("Room").selectOption({ label: roomNumber });
    await fillDate(page, "From", checkIn);
    await fillDate(page, "Until", checkOut);
    await page.getByLabel("Reason").fill("E2E painting");
    const [blockResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/admin/room-blocks") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Block dates" }).click(),
    ]);
    expect(blockResponse.ok()).toBe(true);

    const after = await page.request.post("/api/availability/search", {
      data: { checkIn, checkOut, composition: { adults: 1, childrenUnder5: 0, children5to10: 0 } },
    });
    const afterBody = (await after.json()) as { data?: { availability?: { "single-bed": number } } };
    expect(afterBody.data?.availability?.["single-bed"]).toBe(starting - 1);
  });

  test("desk list and detail fit a 390px screen", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAdmin();
    await signIn(page);
    await page.goto("/admin/bookings");
    await expect(page.getByRole("heading", { name: "Bookings", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "New booking" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Desk" }).getByRole("link", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Desk" }).getByRole("link", { name: "New", exact: true })).toHaveCount(0);
  });

  test("incomplete filters stay on the page and say why", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    await signIn(page);
    await page.goto("/admin/bookings");
    await page.getByLabel("Phone").fill("98765001");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("Phone needs the last 10 digits.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/bookings$/);
    await page.getByLabel("Phone").fill("");
    await page.getByText("More filters").click();
    await fillDate(page, "From", stay(20).checkIn);
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("Set both dates or neither.")).toBeVisible();
  });

  test("dismissing cancel does not claim the stay was cancelled", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    await signIn(page);
    const { checkIn, checkOut } = stay(test.info().project.name === "mobile" ? 140 : 130);
    await page.goto("/admin/bookings/new");
    await fillDate(page, "Check-in", checkIn);
    await fillDate(page, "Check-out", checkOut);
    await page.getByRole("button", { name: "Decrease Adults" }).click();
    await page.getByRole("button", { name: "Walk-in" }).click();
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("heading", { name: "Arrangement" })).toBeVisible();
    await page.locator("section").filter({ hasText: "Arrangement" }).getByRole("button").first().click();
    await page.getByLabel("Name").fill("Cancel Dismiss Guest");
    await page.getByLabel("Phone").fill(test.info().project.name === "mobile" ? "9876500555" : "9876500554");
    await page.getByLabel("Email").fill(
      test.info().project.name === "mobile" ? "cancel.dismiss.mobile@honeydew.example" : "cancel.dismiss.e2e@honeydew.example",
    );
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Cancel Dismiss Guest" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByRole("heading", { name: "Cancel this stay?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep stay" }).click();
    await expect(page.getByText("Booking cancelled.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Cancel Dismiss Guest" })).toBeVisible();
  });

  test("refunds page exposes approve after a cancellation", async ({ page }) => {
    test.skip(!backendConfigured, "DATABASE_URL is required");
    await ensureAdmin();
    await signIn(page);
    const { checkIn, checkOut } = stay(test.info().project.name === "mobile" ? 160 : 150);
    await page.goto("/admin/bookings/new");
    await fillDate(page, "Check-in", checkIn);
    await fillDate(page, "Check-out", checkOut);
    await page.getByRole("button", { name: "Decrease Adults" }).click();
    await page.getByRole("button", { name: "Walk-in" }).click();
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("heading", { name: "Arrangement" })).toBeVisible();
    await page.locator("section").filter({ hasText: "Arrangement" }).getByRole("button").first().click();
    const quoteLine = page.getByText(/Stay total/);
    await expect(quoteLine).toBeVisible();
    const advanceRupees = (await quoteLine.innerText()).split("Advance")[1]?.replace(/\D/g, "") ?? "";
    expect(Number(advanceRupees)).toBeGreaterThan(0);
    await page.getByLabel("Collected now (₹)").fill(advanceRupees);
    await page.getByLabel("Name").fill("Refund Action Guest");
    await page.getByLabel("Phone").fill(test.info().project.name === "mobile" ? "9876500666" : "9876500665");
    await page.getByLabel("Email").fill(
      test.info().project.name === "mobile" ? "refund.action.mobile@honeydew.example" : "refund.action.e2e@honeydew.example",
    );
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Refund Action Guest" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByRole("heading", { name: "Cancel this stay?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel stay" }).click();
    await expect(page.getByText("Booking cancelled.")).toBeVisible();
    await page.goto("/admin/refunds");
    await expect(page.getByRole("heading", { name: "Refunds", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" }).first()).toBeVisible();
  });
});
