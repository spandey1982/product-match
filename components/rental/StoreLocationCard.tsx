import { Phone, MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StoreLocationCardProps {
  storeName?: string | null;
  phone?: string | null;
  address?: string | null;
}

/**
 * Store contact + address, with a small clipped map preview (right side) that
 * links out to Google Maps for real directions. The preview is a stylized
 * SVG, not live map tiles — there's no maps provider wired up yet, and
 * pulling one in just for a static thumbnail would be a new dependency for
 * no real benefit. Always renders contact/address on the left and the map on
 * the right, at every breakpoint — only the map's size shrinks on small
 * screens, it never drops below the text.
 */
export function StoreLocationCard({ storeName, phone, address }: StoreLocationCardProps) {
  const mapQuery = storeName && address ? `${storeName}, ${address}` : address || storeName || "";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <Card className="rounded-3xl overflow-hidden bg-white/90">
      <CardHeader className="px-4 sm:px-5 pt-3.5 pb-1">
        <CardTitle className="font-heading text-base font-medium">
          {storeName ? `Visit ${storeName}` : "Store Location"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 pt-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            {phone && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Phone className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Contact</p>
                  <p className="text-sm font-semibold text-gray-900 font-body truncate">{phone}</p>
                </div>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Address</p>
                  <p className="text-sm font-semibold text-gray-900 font-body leading-snug">{address}</p>
                </div>
              </div>
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
    </Card>
  );
}
