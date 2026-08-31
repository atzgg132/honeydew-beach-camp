import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

// `server-only` throws when imported outside a React Server Component. Tests exercise the
// server modules directly, so it is aliased to an inert stub.
const resolve = {
  alias: {
    "@": path.resolve(root, "src"),
    "server-only": path.resolve(root, "test/server-only.ts"),
  },
};

// Globs cover .tsx as well as .ts so that a component test added later fails loudly rather
// than being silently collected by nothing.
const UNIT = ["src/**/*.test.{ts,tsx}", "test/unit/**/*.test.{ts,tsx}"];
const INTEGRATION = ["src/**/*.integration.test.ts", "test/integration/**/*.test.ts"];
const API = ["src/**/*.api.test.ts", "test/api/**/*.test.ts"];

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          environment: "node",
          include: UNIT,
          // Pure logic only. Anything needing a database belongs to another project.
          exclude: [...INTEGRATION, ...API, "**/node_modules/**"],
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: INTEGRATION,
          setupFiles: ["test/setup/integration.ts"],
          // These suites truncate tables. They must never share a database, and a
          // serialized run keeps the truncation in one file from cutting across another.
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
      {
        resolve,
        test: {
          name: "api",
          environment: "node",
          include: API,
          setupFiles: ["test/setup/integration.ts"],
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
