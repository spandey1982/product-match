-- Retailer wallet: switch from a live-exchange-rate USD ledger to a flat
-- credits ledger (1 credit = Rs 10, no live rate). Renames preserve existing
-- transaction history; the exchange-rate columns are dropped since the new
-- system never computes one.

-- AlterTable: wallets
ALTER TABLE "wallets" RENAME COLUMN "balanceUsd" TO "balanceCredits";
ALTER TABLE "wallets" RENAME COLUMN "totalCreditsUsd" TO "totalCredits";
ALTER TABLE "wallets" DROP COLUMN "lastExchangeRate";

-- AlterTable: wallet_transactions
ALTER TABLE "wallet_transactions" RENAME COLUMN "amountUsd" TO "amountCredits";
ALTER TABLE "wallet_transactions" DROP COLUMN "exchangeRate";

-- AlterTable: payment_orders
ALTER TABLE "payment_orders" RENAME COLUMN "amountUsd" TO "amountCredits";
ALTER TABLE "payment_orders" DROP COLUMN "exchangeRate";
