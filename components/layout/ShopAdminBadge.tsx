"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";

/**
 * Visible marker that the retailer/admin session (not the shop customer
 * session — see ShopHeader) is currently active in this browser, with a
 * one-click way to drop it. Exists because admin recognition on /shop is
 * inherited from whatever retailer login is already active, which can look
 * like "admin controls appearing while not logged in" if that session was
 * left over from unrelated dashboard use — this makes the state explicit.
 */
export function ShopAdminBadge({ email }: { email: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleExitAdmin() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/shop");
    router.refresh();
  }

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium"
      title={`Admin session active: ${email}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span className="max-w-[10rem] truncate">Admin</span>
      <button
        onClick={handleExitAdmin}
        disabled={loggingOut}
        aria-label="Exit admin session"
        title="Exit admin session"
        className="h-5 w-5 rounded-full flex items-center justify-center text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
