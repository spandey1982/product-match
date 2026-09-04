import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string; // omitted on the current (last) item
}

/**
 * Visible counterpart to the BreadcrumbList JSON-LD already emitted on
 * app/shop/[id] — structured data should describe visible content, not
 * substitute for it.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 flex-wrap">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-gray-800 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-800 font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
