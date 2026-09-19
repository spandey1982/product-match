"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, LogIn, LogOut, Phone } from "lucide-react";

/**
 * Account/profile icon for HmNavBar (2026-09-15), mirroring components/
 * layout/CustomerAuthStatus.tsx's shape (icon → dropdown, signed-in vs
 * signed-out content) restyled to Sage Studio. A real HmUser session
 * always exists once someone has interacted at all — the OTP gate is
 * temporarily bypassed (see lib/home-material/auth.ts's
 * getOrCreateHmUserSession) and every visitor auto-provisions a guest
 * row — so "signed in" here specifically means a REAL verified phone,
 * distinguished from a guest by the synthetic `guest_<uuid>` phone
 * pattern only guest rows ever get. A guest sees "Sign in", never a fake
 * "Hello, guest_xxxxx".
 */
export function HmAccountMenu({ phone }: { phone: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isRealUser = !!phone && !phone.startsWith("guest_");

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/home-material/auth/logout", { method: "POST" });
    router.push("/materials");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        title="Account"
        className="h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-[var(--color-indigo-600)] hover:bg-[var(--color-indigo-50)] transition-colors"
      >
        <User className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
            {isRealUser ? (
              <>
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-900">Hello</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {phone}
                  </p>
                </div>
                <div className="h-px bg-gray-100 mx-1 my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/materials/login"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <LogIn className="h-4 w-4 text-[var(--color-indigo-500)]" />
                Sign in
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
