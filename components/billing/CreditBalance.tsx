"use client";

import { useEffect, useState } from "react";

interface BalanceData {
  billingEnabled: boolean;
  hasWallet?: boolean;
  remainingPercentage: number;
  usedPercentage?: number;
  status?: string;
}

function opacityForPercentage(pct: number): number {
  if (pct >= 50) return 1;
  if (pct >= 20) return 0.7;
  return 0.45;
}

function ringStrokeForPercentage(pct: number): string {
  const opacity = opacityForPercentage(pct);
  return `rgba(99, 102, 241, ${opacity})`;
}

function FrozenOverlay() {
  return (
    <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-10">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(135deg, rgba(147,197,253,0.45) 0%, rgba(191,219,254,0.3) 40%, rgba(224,242,254,0.5) 60%, rgba(147,197,253,0.35) 100%)",
          backdropFilter: "blur(0.5px)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)",
        }}
      />
    </div>
  );
}

function CreditRing({
  pct,
  isFrozen,
  children,
}: {
  pct: number;
  isFrozen: boolean;
  children: React.ReactNode;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const strokeColor = ringStrokeForPercentage(pct);

  return (
    <div className="relative shrink-0" style={{ width: 38, height: 38 }}>
      <svg
        className="-rotate-90"
        width={38}
        height={38}
        viewBox="0 0 38 38"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <circle
          cx="19" cy="19" r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="2.5"
        />
        <circle
          cx="19" cy="19" r={radius}
          fill="none" stroke={strokeColor} strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {children}
      </div>
      {isFrozen && <FrozenOverlay />}
    </div>
  );
}

function DropdownPill({ pct, isFrozen }: { pct: number; isFrozen: boolean }) {
  const opacity = opacityForPercentage(pct);

  return (
    <div className="px-3 py-2 mb-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Credits</span>
        <div className="flex items-center gap-1.5">
          {isFrozen && (
            <span className="text-[10px] font-semibold text-blue-400">Frozen</span>
          )}
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: `rgba(99, 102, 241, ${Math.max(opacity, 0.5)})` }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, rgba(99,102,241,${opacity}), rgba(139,92,246,${opacity}))`,
          }}
        />
      </div>
    </div>
  );
}

export function useCreditBalance() {
  const [data, setData] = useState<BalanceData | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/wallet/balance")
      .then((r) => r.json())
      .then((d: BalanceData) => { if (mounted) setData(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  return data;
}

export function CreditBalanceRing({
  balance,
  children,
}: {
  balance: BalanceData | null;
  children: React.ReactNode;
}) {
  if (!balance || !balance.billingEnabled || !balance.hasWallet) {
    return <>{children}</>;
  }

  return (
    <CreditRing
      pct={balance.remainingPercentage}
      isFrozen={balance.status === "frozen"}
    >
      {children}
    </CreditRing>
  );
}

export function CreditBalanceDropdown({ balance }: { balance: BalanceData | null }) {
  if (!balance || !balance.billingEnabled || !balance.hasWallet) return null;
  return (
    <DropdownPill
      pct={balance.remainingPercentage}
      isFrozen={balance.status === "frozen"}
    />
  );
}
