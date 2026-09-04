import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/password";
import { db } from "@/server/db/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function get(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: "GET",
    headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", ...headers },
  });
}

async function readJson(response: Response) {
  return (await response.json()) as {
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string };
  };
}

function cookieHeader(response: Response) {
  const pairs = response.headers.getSetCookie().map((entry) => entry.split(";", 1)[0]);
  return pairs.join("; ");
}

function csrfFrom(response: Response) {
  const match = response.headers.getSetCookie().find((entry) => entry.startsWith("hd_admin_csrf="));
  return match ? decodeURIComponent(match.slice("hd_admin_csrf=".length).split(";", 1)[0]) : "";
}

describe.skipIf(!testDatabaseUrl)("admin API routes", () => {
  beforeAll(async () => {
    const rooms = await db().room.count();
    if (rooms !== 7) throw new Error("Apply migrations and seed TEST_DATABASE_URL before running API tests.");
  });

  beforeEach(async () => {
    await db().adminSession.deleteMany();
    await db().adminInvitation.deleteMany();
    await db().adminUser.deleteMany();
  });

  afterAll(async () => {
    await db().adminSession.deleteMany();
    await db().adminInvitation.deleteMany();
    await db().adminUser.deleteMany();
  });

  it("rejects an unauthenticated overview", async () => {
    const { GET } = await import("@/app/api/admin/overview/route");
    const response = await GET(get("/api/admin/overview"));
    expect(response.status).toBe(401);
    expect((await readJson(response)).error?.code).toBe("ADMIN_SESSION_REQUIRED");
  });

  it("signs in a provisioned administrator and signs out", async () => {
    await db().adminUser.create({
      data: {
        email: "desk@honeydew.example",
        passwordHash: await hashPassword("correct-horse-battery"),
        acceptedAt: new Date(),
      },
    });
    const { POST, DELETE } = await import("@/app/api/admin/session/route");
    const login = await POST(post("/api/admin/session", { email: "desk@honeydew.example", password: "correct-horse-battery" }));
    expect(login.status).toBe(200);
    expect((await readJson(login)).data?.email).toBe("desk@honeydew.example");

    const cookies = cookieHeader(login);
    const csrf = csrfFrom(login);
    const { GET } = await import("@/app/api/admin/overview/route");
    const overview = await GET(get("/api/admin/overview", { cookie: cookies }));
    expect(overview.status).toBe(200);

    const logout = await DELETE(
      new NextRequest("http://127.0.0.1:3000/api/admin/session", {
        method: "DELETE",
        headers: {
          cookie: cookies,
          "x-csrf-token": csrf,
          origin: "http://127.0.0.1:3000",
          host: "127.0.0.1:3000",
        },
      }),
    );
    expect(logout.status).toBe(204);
  });

  it("rejects a wrong password", async () => {
    await db().adminUser.create({
      data: {
        email: "desk@honeydew.example",
        passwordHash: await hashPassword("correct-horse-battery"),
        acceptedAt: new Date(),
      },
    });
    const { POST } = await import("@/app/api/admin/session/route");
    const response = await POST(post("/api/admin/session", { email: "desk@honeydew.example", password: "nope-nope-nope" }));
    expect(response.status).toBe(401);
  });

  it("rejects a disabled administrator", async () => {
    await db().adminUser.create({
      data: {
        email: "disabled@honeydew.example",
        passwordHash: await hashPassword("correct-horse-battery"),
        acceptedAt: new Date(),
        disabledAt: new Date(),
      },
    });
    const { POST } = await import("@/app/api/admin/session/route");
    const response = await POST(post("/api/admin/session", { email: "disabled@honeydew.example", password: "correct-horse-battery" }));
    expect(response.status).toBe(401);
  });

  it("consumes an invitation and opens a session", async () => {
    const { bootstrapFirstAdmin } = await import("@/server/auth/admin-session");
    const invitation = await bootstrapFirstAdmin("owner@honeydew.example");
    const token = new URL(invitation.acceptUrl).searchParams.get("token");
    expect(token).toBeTruthy();
    const { POST } = await import("@/app/api/admin/accept/route");
    const accepted = await POST(post("/api/admin/accept", { token, password: "correct-horse-battery" }));
    expect(accepted.status).toBe(200);
    const cookies = cookieHeader(accepted);
    const { GET } = await import("@/app/api/admin/overview/route");
    const overview = await GET(get("/api/admin/overview", { cookie: cookies }));
    expect(overview.status).toBe(200);
  });

  it("rejects booking reads without a session and mutations without CSRF", async () => {
    await db().adminUser.create({
      data: {
        email: "desk@honeydew.example",
        passwordHash: await hashPassword("correct-horse-battery"),
        acceptedAt: new Date(),
      },
    });
    const { GET } = await import("@/app/api/admin/bookings/route");
    const anonymous = await GET(get("/api/admin/bookings"));
    expect(anonymous.status).toBe(401);

    const { POST } = await import("@/app/api/admin/session/route");
    const login = await POST(post("/api/admin/session", { email: "desk@honeydew.example", password: "correct-horse-battery" }));
    const cookies = cookieHeader(login);
    const csrf = csrfFrom(login);

    const { POST: invite } = await import("@/app/api/admin/invitations/route");
    const missingCsrf = await invite(
      post("/api/admin/invitations", { email: "night@honeydew.example" }, { cookie: cookies }),
    );
    expect(missingCsrf.status).toBe(403);
    expect((await readJson(missingCsrf)).error?.code).toBe("CSRF_FAILED");

    const badOrigin = await invite(
      post(
        "/api/admin/invitations",
        { email: "night@honeydew.example" },
        { cookie: cookies, "x-csrf-token": csrf, origin: "http://evil.example", host: "127.0.0.1:3000" },
      ),
    );
    expect(badOrigin.status).toBe(403);
    expect((await readJson(badOrigin)).error?.code).toBe("ORIGIN_FAILED");
  });

  it("rate limits repeated login attempts for one address", async () => {
    await db().adminUser.create({
      data: {
        email: "limited@honeydew.example",
        passwordHash: await hashPassword("correct-horse-battery"),
        acceptedAt: new Date(),
      },
    });
    const { POST } = await import("@/app/api/admin/session/route");
    let last = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(post("/api/admin/session", { email: "limited@honeydew.example", password: "wrong-password-value" }));
      last = response.status;
    }
    expect(last).toBe(429);
  });
});
