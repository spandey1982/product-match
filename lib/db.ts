import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  const url = rawUrl
    ? rawUrl.startsWith("file:./") || rawUrl.startsWith("file:../")
      ? `file:${path.resolve(rawUrl.slice(5))}`
      : rawUrl
    : `file:${dbPath}`;

  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
