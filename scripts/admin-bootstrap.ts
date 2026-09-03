import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to bootstrap an administrator.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Set ADMIN_BOOTSTRAP_EMAIL to the first administrator address and run again.");
    process.exit(1);
  }

  const existing = await prisma.adminUser.count();
  if (existing > 0) {
    throw new Error("An administrator already exists. Refusing to bootstrap again.");
  }

  const token = randomBytes(32).toString("base64url");
  const user = await prisma.adminUser.create({ data: { email } });
  await prisma.adminInvitation.create({
    data: {
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      adminUserId: user.id,
    },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  console.log(`Invitation created for ${email}`);
  console.log(`${origin.replace(/\/$/, "")}/admin/accept?token=${encodeURIComponent(token)}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Bootstrap failed.";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
