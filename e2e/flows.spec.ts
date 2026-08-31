import { expect, test, type Page } from "@playwright/test";

const backendConfigured = Boolean(process.env.DATABASE_URL);

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fillContact(page: Page) {
  await page.getByLabel("Full name").fill("Sana Kapoor");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Email").fill("sana.demo@honeydew.example");
  await page.getByRole("button", { name: "Continue" }).click();
}

async function setAllRoomsAc(page: Page) {
  await expect(page.getByRole("heading", { name: "Air-conditioning" })).toBeVisible();
  const buttons = page.getByRole("button", { name: "AC included" });
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).click();
  }
}

// Every booking this suite completes takes its own dates. The camp has seven physical
// rooms and a hold survives for fifteen minutes, so reusing an offset across the two
// browser projects or across a retry exhausts the inventory and fails for the wrong reason.
let bookingSequence = 0;

/** A stay far enough out to sit in the zero-deduction cancellation band. */
function nextDistantStayOffset(): number {
  bookingSequence += 1;
  return 40 + bookingSequence * 3;
}

/**
 * A stay inside the "Within 7 days" cancellation band but clear of the 48-hour boundary,
 * rotated so repeated attempts do not all land on one date.
 */
let nearSequence = 0;
function nextNearStayOffset(): number {
  nearSequence += 1;
  return 3 + (nearSequence % 4);
}

async function createSimpleBooking(page: Page, days: number) {
  await page.goto(`/book?checkIn=${futureDate(days)}&checkOut=${futureDate(days + 1)}&adults=1&childrenUnder5=0&children5to10=0&step=arrangement`);
  await page.getByRole("button", { name: /Single-Bed Room · 1 guest/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page);
  await page.getByRole("button", { name: "Continue to advance" }).click();
  await page.getByRole("button", { name: "Pay advance" }).click();
  await expect(page.getByRole("heading", { name: "Stay reserved" })).toBeVisible();
  return (await page.locator("p.text-2xl").textContent())?.trim() ?? "";
}

test.describe("public site", () => {
  test("homepage renders logo, hero, and book now", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "A stay on Mousuni Island." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Honey Dew Beach Camp home/i }).first()).toBeVisible();
    await expect(page.getByRole("banner").getByText("Honey Dew")).toBeVisible();
    await expect(page.getByRole("banner").getByText("Beach Camp")).toBeVisible();
    await expect(page.getByRole("link", { name: "Book now" }).first()).toBeVisible();
  });

  test("room pages use Single-Bed and Double-Bed", async ({ page }) => {
    await page.goto("/rooms/single-bed");
    await expect(page.getByRole("heading", { name: "Single-Bed Room" })).toBeVisible();
    await page.goto("/rooms/double-bed");
    await expect(page.getByRole("heading", { name: "Double-Bed Room" })).toBeVisible();
    const ac = await page.goto("/rooms/ac");
    expect(ac?.status()).toBe(404);
  });

  test("contact shows real address and phones", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("main").getByText("Mousuni Island", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "79808 41770" }).first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Have a special request?")).toBeVisible();
  });
});

test.describe("booking", () => {
  test.skip(!backendConfigured, "Booking browser tests require a migrated and seeded PostgreSQL DATABASE_URL.");
  test("empty /book shows the date step", async ({ page }) => {
    await page.goto("/book");
    await expect(page.getByRole("heading", { name: "Choose dates" })).toBeVisible();
    await expect(page.getByText("Meals at the camp are included in the stay charges.").first()).toBeVisible();
  });

  test("single guest uses 2-head rate for one person", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(20)}&checkOut=${futureDate(21)}&adults=1&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await page.getByRole("button", { name: /Single-Bed Room · 1 guest/ }).click();
    await page.getByRole("button", { name: "AC included" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await fillContact(page);
    await expect(page.getByText("₹1,499 a night")).toBeVisible();
  });

  test("four people can book one Double-Bed AC at ₹5,596", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(21)}&checkOut=${futureDate(22)}&adults=4&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await page.getByRole("button", { name: /Double-Bed Room · 4 guests/ }).click();
    await setAllRoomsAc(page);
    await expect(page.getByText("₹5,596 a night")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await fillContact(page);
    await expect(page.getByText("₹5,596 a night")).toBeVisible();
    await expect(page.getByText("Stay total").locator("..").getByText("₹5,596")).toBeVisible();
  });

  test("four people can book two Single-Bed rooms at ₹5,996", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(22)}&checkOut=${futureDate(23)}&adults=4&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await page.getByRole("button", { name: /2 × Single-Bed Room · 2 guests/ }).click();
    await setAllRoomsAc(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await fillContact(page);
    await expect(page.getByText("Stay total").locator("..").getByText("₹5,996")).toBeVisible();
  });

  test("five guests can choose 2 + 3 Single-Bed rooms", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(23)}&checkOut=${futureDate(24)}&adults=5&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await page.getByRole("button", { name: /Single-Bed Room · 3 guests/ }).click();
    await expect(page.getByRole("heading", { name: "Air-conditioning" })).toBeVisible();
    await expect(page.getByText("Room 1 · Single-Bed Room")).toBeVisible();
    await expect(page.getByText("Room 2 · Single-Bed Room")).toBeVisible();
  });

  test("seven guests book multiple rooms with no room over capacity", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(24)}&checkOut=${futureDate(25)}&adults=7&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await expect(page.getByRole("heading", { name: "Choose a room setup" })).toBeVisible();
    await expect(page.getByText("7-guest")).toHaveCount(0);
    await page.locator("button").filter({ hasText: "guests" }).first().click();
    await expect(page.getByRole("heading", { name: "Air-conditioning" })).toBeVisible();
    await expect(page.getByText(/Room 1 ·/)).toBeVisible();
    await expect(page.getByText(/Room 2 ·/)).toBeVisible();
  });

  test("review has no special-request field and includes a call prompt", async ({ page }) => {
    await page.goto(
      `/book?checkIn=${futureDate(25)}&checkOut=${futureDate(26)}&adults=2&childrenUnder5=0&children5to10=0&step=arrangement`,
    );
    await page.getByRole("button", { name: /Single-Bed Room · 2 guests/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Special request")).toHaveCount(0);
    await fillContact(page);
    await expect(page.getByLabel("Special request")).toHaveCount(0);
    await expect(page.getByText("Have a special request?")).toBeVisible();
  });
});

test.describe("manage booking", () => {
  test.skip(!backendConfigured, "Manage Booking browser tests require a migrated and seeded PostgreSQL DATABASE_URL.");

  test("verifies a secure session and upgrades one room", async ({ page }) => {
    const reference = await createSimpleBooking(page, nextDistantStayOffset());
    // The confirmation page link, not the header or footer one: only this carries ?ref=,
    // which prefills the booking reference the lookup form needs.
    await page.locator('a[href^="/manage-booking?ref="]').click();
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByRole("button", { name: "Find booking" }).click();
    await expect(page.getByRole("heading", { name: reference })).toBeVisible();
    await expect(page.getByText("Dates cannot be changed online.")).toBeVisible();
    const balance = page.locator("div").filter({ hasText: /^Balance at the hotel/ }).locator("dd");
    const before = await balance.textContent();
    const upgradeToggle = page.getByRole("button", { name: /Air-conditioning · Room 1/ });
    if (await upgradeToggle.isVisible()) await upgradeToggle.click();
    await page.getByRole("button", { name: /Upgrade Room 1/ }).click();
    await page.getByRole("button", { name: "Confirm upgrade" }).click();
    const after = await balance.textContent();
    expect(after).not.toEqual(before);
  });

  test("shows a server cancellation quote and cancels atomically", async ({ page }) => {
    const reference = await createSimpleBooking(page, nextNearStayOffset());
    // The confirmation page link, not the header or footer one: only this carries ?ref=,
    // which prefills the booking reference the lookup form needs.
    await page.locator('a[href^="/manage-booking?ref="]').click();
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByRole("button", { name: "Find booking" }).click();
    await expect(page.getByRole("heading", { name: reference })).toBeVisible();
    const cancellationToggle = page.getByRole("button", { name: "Cancellation" });
    if (await cancellationToggle.isVisible()) await cancellationToggle.click();
    await expect(page.getByText(/Within 7 days/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel stay" }).click();
    await page.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("Cancelled")).toBeVisible();
  });
});

test.describe("mobile nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Gallery" }).click();
    await expect(page).toHaveURL(/\/gallery/);
  });

  test("shows the full camp name without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByText("Honey Dew")).toBeVisible();
    await expect(banner.getByText("Beach Camp")).toBeVisible();
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});
