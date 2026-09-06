import { afterEach, describe, expect, it, vi } from "vitest";
import { smtpConfig } from "@/server/notifications/config";
import { assertEmailProviderConfigured, getEmailProvider } from "@/server/notifications/provider";

const SMTP_KEYS = ["EMAIL_PROVIDER", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];

describe("smtp configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null without credentials", () => {
    for (const key of SMTP_KEYS) vi.stubEnv(key, "");
    expect(smtpConfig()).toBeNull();
  });

  it("defaults to Gmail when only credentials are set", () => {
    for (const key of SMTP_KEYS) vi.stubEnv(key, "");
    vi.stubEnv("SMTP_USER", "honeydewbeachcamp@gmail.com");
    vi.stubEnv("SMTP_PASS", "abcd efgh ijkl mnop");
    expect(smtpConfig()).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "honeydewbeachcamp@gmail.com",
      pass: "abcdefghijklmnop",
    });
  });

  it("honours host, port and STARTTLS overrides", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "camp@example.test");
    vi.stubEnv("SMTP_PASS", "secret");
    const config = smtpConfig();
    expect(config?.host).toBe("smtp.example.test");
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
    vi.stubEnv("SMTP_SECURE", "true");
    expect(smtpConfig()?.secure).toBe(true);
  });

  it("falls back to port 465 on a bad port value", () => {
    vi.stubEnv("SMTP_PORT", "not-a-port");
    vi.stubEnv("SMTP_USER", "camp@example.test");
    vi.stubEnv("SMTP_PASS", "secret");
    expect(smtpConfig()?.port).toBe(465);
  });
});

describe("smtp provider resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the smtp adapter only when selected", () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    expect(getEmailProvider().name).toBe("console");
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    expect(getEmailProvider().name).toBe("smtp");
  });

  it("fails the delivery run loudly when smtp credentials are missing", () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    expect(() => assertEmailProviderConfigured()).toThrow(/SMTP_USER/);
  });

  it("passes the delivery check with credentials present", () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("SMTP_USER", "honeydewbeachcamp@gmail.com");
    vi.stubEnv("SMTP_PASS", "app-password");
    expect(() => assertEmailProviderConfigured()).not.toThrow();
  });

  it("ignores smtp credentials when the console provider is selected", () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    expect(() => assertEmailProviderConfigured()).not.toThrow();
  });
});
