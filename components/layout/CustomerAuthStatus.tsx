"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, UserCircle, MapPin, Package, LogOut, LogIn, UserPlus, Phone } from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";

/**
 * Single profile icon + dropdown for the /rent header. Logged out: just
 * Sign In (default) / Sign Up. Logged in: account details + My
 * Account/Address/Orders + Sign out — those three are only ever shown to a
 * signed-in customer, never to a guest.
 */
export function CustomerAuthStatus({
  phone,
  name,
}: {
  phone: string | null;
  name?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/customer-auth/logout", { method: "POST" });
    router.push("/rent");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white hover:opacity-90 transition-opacity"
      >
        <User className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
            {phone ? (
              <>
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {name ? `Hello, ${name}` : "Hello"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {phone}
                  </p>
                </div>
                <div className="h-px bg-gray-100 mx-1 my-1" />

                <Link
                  href="/rent/account"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserCircle className="h-4 w-4 text-indigo-400" />
                  My Account
                </Link>

                <Link
                  href="/rent/addresses"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-indigo-400" />
                  My Address
                </Link>

                <Link
                  href="/rent/orders"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Package className="h-4 w-4 text-indigo-400" />
                  My Orders
                </Link>

                <Link
                  href="/rent/my-try-ons"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <HangerPlusIcon className="h-4 w-4 text-indigo-400" />
                  My Try-Ons
                </Link>

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
              <>
                <Link
                  href="/rent/login"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <LogIn className="h-4 w-4 text-indigo-500" />
                  Sign In
                </Link>
                <Link
                  href="/rent/login?intent=signup"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
