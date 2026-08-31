import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/contracts/errors";

const globalForPrisma = globalThis as unknown as { honeydewPrisma?: PrismaClient };

// Serverless functions reuse a warm process across invocations, so the client and its
// pg pool must be cached in every environment. Creating one per call exhausts the
// database connection limit under load.
export function db(): PrismaClient {
  if (globalForPrisma.honeydewPrisma) return globalForPrisma.honeydewPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "The booking service is not configured.");
  }
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...(Number.isInteger(max) && max > 0 ? { max } : {}),
    }),
  });
  globalForPrisma.honeydewPrisma = client;
  return client;
}

// Test-only. Lets an integration suite point the cached client at a disposable database
// and dispose of it afterwards without leaking pooled connections between files.
export async function resetDbClientForTests(): Promise<void> {
  const existing = globalForPrisma.honeydewPrisma;
  globalForPrisma.honeydewPrisma = undefined;
  await existing?.$disconnect();
}
