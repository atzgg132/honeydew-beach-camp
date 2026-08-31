import { beforeAll } from "vitest";

/**
 * Integration suites truncate business tables. They must only ever run against a database
 * that can be thrown away.
 *
 * Being careful here is not paranoia: `TEST_DATABASE_URL` is a plain string that someone
 * will eventually paste the production value into, and the failure mode is silent, total
 * and unrecoverable. Every check below is a refusal, never a warning.
 */

const PRODUCTION_MARKERS = [
  // Deployment platforms that identify a live environment.
  () => process.env.VERCEL_ENV === "production",
  () => process.env.NODE_ENV === "production",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function databaseNameOf(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

// Captured before anything below reassigns DATABASE_URL. Comparing against the live value
// would compare the test database with itself once the override has happened.
const runtimeDatabaseUrl = process.env.DATABASE_URL;

export function assertDisposableDatabase(url: string): void {
  const marker = PRODUCTION_MARKERS.find((check) => check());
  if (marker) {
    throw new Error(
      "Refusing to run destructive integration tests: the environment reports itself as production.",
    );
  }

  const host = hostOf(url);
  if (!host) {
    throw new Error("TEST_DATABASE_URL is not a valid connection URL.");
  }

  // If the runtime database is configured, the test database must be a different server or
  // at least a different database name. Same host and same name means they are the same
  // database, whatever the credentials say.
  const runtime = runtimeDatabaseUrl;
  if (runtime) {
    const runtimeHost = hostOf(runtime);
    const runtimeName = databaseNameOf(runtime);
    const testName = databaseNameOf(url);
    if (runtimeHost && runtimeHost === host && runtimeName === testName) {
      throw new Error(
        "Refusing to run destructive integration tests: TEST_DATABASE_URL points at the same " +
          "host and database as DATABASE_URL. Use a separate database or a Neon test branch.",
      );
    }
  }

  // An explicit opt-in is required to point the destructive suites at any managed host.
  // Local Postgres and CI service containers are allowed without ceremony.
  const isLocal = host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DATABASE !== "true") {
    throw new Error(
      `Refusing to run destructive integration tests against the remote host "${host}". ` +
        "Set ALLOW_REMOTE_TEST_DATABASE=true only for a database branch created for testing.",
    );
  }
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

beforeAll(() => {
  if (!testDatabaseUrl) return;
  assertDisposableDatabase(testDatabaseUrl);
});

// Suites read DATABASE_URL through the shared client, so point it at the disposable
// database before any module resolves it.
if (testDatabaseUrl) {
  assertDisposableDatabase(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.APP_TOKEN_SECRET ??= "integration-app-token-secret-value-0123456789";
  process.env.PII_LOOKUP_PEPPER ??= "integration-pii-lookup-pepper-value-0123456789";
}
