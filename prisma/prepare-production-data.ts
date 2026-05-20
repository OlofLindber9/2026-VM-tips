/**
 * Prepare a database for production use.
 *
 * Keeps real group-stage fixtures/users, removes known demo account data, and
 * replaces simulated knockout results with a placeholder bracket.
 *
 * Run against the target database:
 *   npm run db:prepare-production
 */

import * as nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const TEST_USER_EMAIL = "test@test.se";

async function main() {
  console.log("Preparing production data ...");

  const removedTestData = await removeKnownTestAccount();
  if (removedTestData) {
    console.log("  Removed known demo account data");
  } else {
    console.log("  No known demo account found");
  }

  const { seedKnockoutBracket, disconnectKnockoutSeedPrisma } = await import("./seed-knockout");
  await seedKnockoutBracket();
  await disconnectKnockoutSeedPrisma();

  const summary = await prisma.match.groupBy({
    by: ["stage", "status"],
    _count: { _all: true },
    orderBy: [{ stage: "asc" }, { status: "asc" }],
  });

  console.log("  Match summary:");
  for (const row of summary) {
    console.log(`    ${row.stage}/${row.status}: ${row._count._all}`);
  }
  console.log("Done.");
}

async function removeKnownTestAccount(): Promise<boolean> {
  const testUser = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
    select: { id: true },
  });

  if (!testUser) return false;

  await prisma.chatMessage.deleteMany({ where: { userId: testUser.id } });
  await prisma.prediction.deleteMany({ where: { userId: testUser.id } });
  await prisma.groupMembership.deleteMany({ where: { userId: testUser.id } });
  await prisma.group.deleteMany({ where: { createdBy: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });

  return true;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
