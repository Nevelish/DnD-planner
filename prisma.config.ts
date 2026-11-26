import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // For migrations. Read straight from the environment (not Prisma's env(),
  // which insists it's set): `prisma generate` in the Docker build runs
  // without a database.
  datasource: {
    url: process.env.DATABASE_URL,
    // Only for checking migrations against the schema (`prisma migrate diff
    // --from-migrations`); a scratch database that gets wiped.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
