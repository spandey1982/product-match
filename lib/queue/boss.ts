/**
 * pg-boss singleton — PostgreSQL-backed job queue.
 *
 * Uses the existing DATABASE_URL (no new infrastructure). pg-boss creates its
 * own `pgboss` schema on first start, completely separate from Prisma's tables.
 * Lazy-initialized and cached per process, same pattern as lib/db.ts.
 *
 * Retry/expiration/retention are per-queue options in pg-boss v12 (not
 * constructor options) — set once via createQueue() the first time each
 * queue is touched; see QUEUE_OPTIONS in types.ts.
 */
import { PgBoss } from "pg-boss";
import { QUEUES, QUEUE_OPTIONS } from "./types";

const globalForBoss = globalThis as unknown as {
  pgBoss: PgBoss | undefined;
};

function createBoss(): PgBoss {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the job queue");
  }
  return new PgBoss({ connectionString, schema: "pgboss" });
}

let startPromise: Promise<PgBoss> | null = null;

async function initQueues(boss: PgBoss): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name, QUEUE_OPTIONS[name]);
  }
}

/**
 * Get the started pg-boss instance with all known queues created. Safe to
 * call multiple times — returns the same started instance. The first call
 * triggers schema creation, start, and queue registration; subsequent calls
 * return immediately.
 */
export async function getBoss(): Promise<PgBoss> {
  if (!startPromise) {
    const boss = globalForBoss.pgBoss ?? createBoss();
    if (process.env.NODE_ENV !== "production") globalForBoss.pgBoss = boss;
    startPromise = boss.start().then(async () => {
      await initQueues(boss);
      return boss;
    });
  }
  return startPromise;
}
