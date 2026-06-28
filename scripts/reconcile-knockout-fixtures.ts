import * as nextEnv from "@next/env";
import { reconcileKnockoutFixtureMappings } from "../lib/sync";
import { prisma } from "../lib/prisma";

nextEnv.loadEnvConfig(process.cwd());

reconcileKnockoutFixtureMappings()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
