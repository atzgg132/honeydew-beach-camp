import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/contracts/errors";

const globalForPrisma = globalThis as unknown as { honeydewPrisma?: PrismaClient };

export function db(): PrismaClient {
  if (globalForPrisma.honeydewPrisma) return globalForPrisma.honeydewPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "The booking service is not configured.");
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  if (process.env.NODE_ENV !== "production") globalForPrisma.honeydewPrisma = client;
  return client;
}
