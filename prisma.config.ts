import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: [".env.local", ".env"], quiet: true });

// Migrations and seeds run against the direct/session connection; the pooled URL is a
// fallback for environments that only configure one.
//
// There is deliberately no default value here. A missing URL must surface as a loud
// Prisma error on the commands that need a database, rather than silently pointing a
// misconfigured CI job or release job at some unrelated local server.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});
