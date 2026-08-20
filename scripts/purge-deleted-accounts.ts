/**
 * Manual/local runner for the 7-day account-deletion purge — see
 * lib/account/purge.ts for the actual logic (shared with the
 * /api/internal/purge-deleted-accounts route, which is the one an external
 * scheduler should call in production).
 *
 * Usage:
 *   npx tsx scripts/purge-deleted-accounts.ts
 */
import "dotenv/config";
import { purgeDeletedAccounts } from "../lib/account/purge";

async function main() {
  const { purgedCount, purgedIds } = await purgeDeletedAccounts();
  console.log(`Purged ${purgedCount} account(s)${purgedCount ? ": " + purgedIds.join(", ") : ""}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
