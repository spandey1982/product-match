"use client";
import { useEffect, useRef, useState } from "react";
import { Store, Phone, MapPin, Navigation, PhoneCall, Copy, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StoreLocationCardProps {
  storeName?: string | null;
  phone?: string | null;
  address?: string | null;
  /** Renders the header as a toggle and starts collapsed — /shop's product detail page uses this; /rent leaves it always-expanded. */
  collapsible?: boolean;
}

/**
 * Store name/contact/address, with a small clipped map preview (right side)
 * that links out to Google Maps for real directions. The preview is a
 * stylized SVG, not live map tiles — there's no maps provider wired up yet,
 * and pulling one in just for a static thumbnail would be a new dependency
 * for no real benefit. Shared by /rent and /shop's product detail pages.
 * No per-row text labels (Contact/Address) — each row's icon carries that
 * meaning on its own, and copy/call feedback swaps the icon itself rather
 * than adding a label.
 */
export function StoreLocationCard({ storeName, phone, address, collapsible }: StoreLocationCardProps) {
  const mapQuery = storeName && address ? `${storeName}, ${address}` : address || storeName || "";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  const [expanded, setExpanded] = useState(!collapsible);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const phoneMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!phoneMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (phoneMenuRef.current && !phoneMenuRef.current.contains(e.target as Node)) {
        setPhoneMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [phoneMenuOpen]);

  async function copyPhone() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setPhoneCopied(true);
      setTimeout(() => {
        setPhoneCopied(false);
        setPhoneMenuOpen(false);
      }, 1200);
    } catch {
      /* clipboard unavailable — silently no-op, the Call option still works */
    }
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silently no-op */
    }
  }

  return (
    <Card className="rounded-3xl overflow-hidden bg-white/90">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-1 text-left"
          aria-expanded={expanded}
        >
          <CardTitle className="font-heading text-base font-medium">Store Details</CardTitle>
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : (
        <CardHeader className="px-4 sm:px-5 pt-3.5 pb-1">
          <CardTitle className="font-heading text-base font-medium">Store Details</CardTitle>
        </CardHeader>
      )}
      {!expanded ? (
        <div className="pb-3.5" />
      ) : (
      <CardContent className="px-4 sm:px-5 pb-4 pt-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            {storeName && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Store className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-gray-900 font-body truncate">{storeName}</p>
              </div>
            )}

            {phone && (
              <div className="relative" ref={phoneMenuRef}>
                <button
                  type="button"
                  onClick={() => setPhoneMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 w-full text-left rounded-xl -m-1 p-1 hover:bg-gray-50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 font-body truncate">{phone}</p>
                </button>

                {phoneMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-white border border-gray-100 rounded-2xl shadow-lg p-1 overflow-hidden">
                    <a
                      href={`tel:${phone}`}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <PhoneCall className="h-3.5 w-3.5 text-indigo-500" />
                      Call
                    </a>
                    <button
                      type="button"
                      onClick={copyPhone}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {phoneCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                          Copy number
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {address && (
              <button
                type="button"
                onClick={copyAddress}
                title="Tap to copy address"
                className="flex items-start gap-2.5 w-full text-left rounded-xl -m-1 p-1 hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  {addressCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 font-body leading-snug">{address}</p>
              </button>
            )}
          </div>

          {address && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open store location in Google Maps for directions"
              title="Open in Google Maps"
              className="group relative shrink-0 block h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <svg
                viewBox="0 0 120 120"
                preserveAspectRatio="xMidYMid slice"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <rect width="120" height="120" fill="#eef0f4" />
                <rect x="0" y="18" width="120" height="12" fill="#e2e5ea" />
                <rect x="0" y="82" width="120" height="9" fill="#e2e5ea" />
                <rect x="24" y="0" width="8" height="120" fill="#e2e5ea" />
                <rect x="84" y="0" width="10" height="120" fill="#e2e5ea" />
                <rect x="8" y="36" width="34" height="20" fill="#dfeee2" />
                <rect x="68" y="42" width="26" height="26" fill="#dfeee2" />
                <path d="M0 104 L120 32" stroke="#d7dbe2" strokeWidth="5" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-indigo-600 shadow ring-2 ring-white flex items-center justify-center">
                  <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div className="absolute bottom-1 right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-indigo-600 group-hover:bg-white transition-colors">
                <Navigation className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
              </div>
            </a>
          )}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
