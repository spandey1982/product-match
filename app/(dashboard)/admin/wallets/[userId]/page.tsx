import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { WalletDetailView } from "./WalletDetailView";

export const metadata = { title: "Wallet Detail — Admin" };

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function WalletDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      storeName: true,
      wallet: {
        select: {
          id: true,
          balanceUsd: true,
          totalCreditsUsd: true,
          status: true,
          lastExchangeRate: true,
        },
      },
    },
  });

  if (!user) notFound();

  const transactions = user.wallet
    ? await db.walletTransaction.findMany({
        where: { walletId: user.wallet.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const w = user.wallet;
  const remainingPct =
    w && w.totalCreditsUsd > 0
      ? Math.round((w.balanceUsd / w.totalCreditsUsd) * 100)
      : 0;

  const walletData = w
    ? {
        id: w.id,
        balanceUsd: w.balanceUsd,
        totalCreditsUsd: w.totalCreditsUsd,
        remainingPercentage: remainingPct,
        status: w.status,
        lastExchangeRate: w.lastExchangeRate,
      }
    : null;

  const serializedTxns = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amountUsd: t.amountUsd,
    balanceAfter: t.balanceAfter,
    description: t.description,
    initiatedBy: t.initiatedBy,
    originalAmountInr: t.originalAmountInr,
    exchangeRate: t.exchangeRate,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <Link
          href="/admin/wallets"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Wallets
        </Link>
      </div>
      <WalletDetailView
        userId={user.id}
        userName={user.name}
        storeName={user.storeName}
        wallet={walletData}
        transactions={serializedTxns}
      />
    </>
  );
}
