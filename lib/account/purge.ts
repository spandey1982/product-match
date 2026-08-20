import { db } from "@/lib/db";

export const DELETION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Permanently removes every User row whose account-deletion request (see
 * User.deletedAt) is past the 7-day grace period. A hard delete — Prisma's
 * existing cascades handle Product/ModelProfile/Wallet and their children;
 * AutoCatalogBatch/FashionDesign/PaymentOrder have no FK to User by existing
 * design and are deliberately left orphaned, same as today. Called by both
 * the internal purge API route (external scheduler) and the standalone
 * script (manual/local runs).
 */
export async function purgeDeletedAccounts(): Promise<{ purgedCount: number; purgedIds: string[] }> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_PERIOD_MS);

  const due = await db.user.findMany({
    where: { deletedAt: { lte: cutoff } },
    select: { id: true },
  });

  const purgedIds: string[] = [];
  for (const { id } of due) {
    await db.user.delete({ where: { id } });
    purgedIds.push(id);
  }

  return { purgedCount: purgedIds.length, purgedIds };
}
