import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    // Only needed for `prisma migrate diff --from-migrations` (diffing the
    // tracked migration history against schema.prisma) — `migrate dev`
    // auto-manages its own throwaway shadow DB and ignores this. Optional:
    // undefined here reproduces today's behavior exactly for every other command.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
