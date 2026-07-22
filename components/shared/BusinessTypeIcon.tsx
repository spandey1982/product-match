import { Store, Factory, CalendarClock } from "lucide-react";
import { BusinessType } from "@/lib/business-type";

const ICONS: Record<BusinessType, React.ElementType> = {
  RETAILER: Store,
  MANUFACTURER: Factory,
  RENTAL_STORE: CalendarClock,
};

/** Single source of truth for "which icon goes with which business type" — shared by the signup form and the Navbar profile display. */
export function BusinessTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type as BusinessType] ?? Store;
  return <Icon className={className} />;
}
