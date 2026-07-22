"use client";
import Link from "next/link";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { getProductCardImages } from "@/lib/product/card-images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMockRentalInfo } from "@/lib/rental/mock-data";
import { AGE_GROUPS, RentalAvailability } from "@/lib/rental/types";
import { TryOnCardButton } from "@/components/trial-room/TryOnCardButton";

const AVAILABILITY_BADGE: Record<RentalAvailability, { label: string; variant: "success" | "warning" | "error" }> = {
  available: { label: "Available", variant: "success" },
  reserved: { label: "Reserved", variant: "warning" },
  rented_out: { label: "Rented Out", variant: "error" },
};

const AGE_RANGE_LABEL = `Ages ${AGE_GROUPS[0].split("-")[0]}–${AGE_GROUPS[AGE_GROUPS.length - 1].split("-")[1]} yrs`;

interface RentalProductCardProps {
  product: Product & { storeName?: string | null };
  /** Show the try-on quick button? Hidden entirely for guests — no logged-in customer to attach a try-on to. */
  showTryOn?: boolean;
}

export function RentalProductCard({ product, showTryOn = false }: RentalProductCardProps) {
  const rental = getMockRentalInfo(product);
  const availability = AVAILABILITY_BADGE[rental.availability];

  return (
    <Link href={`/rent/${product.id}`} className="group block">
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        <div className="relative aspect-[3/4]">
          <div className="absolute inset-0 overflow-hidden rounded-t-2xl bg-gray-50">
            <ImageCarousel
              images={getProductCardImages(product)}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />
          </div>

          <div className="absolute left-3 top-3 z-10">
            <Badge variant={availability.variant}>{availability.label}</Badge>
          </div>

          {showTryOn && (
            <div className="absolute right-3 top-3 z-20">
              <TryOnCardButton product={product} myTryOnsHref="/rent/my-try-ons" />
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-4 space-y-2">
          <h3
            title={product.title}
            className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.25rem] group-hover:text-indigo-600 transition-colors"
          >
            {product.title}
          </h3>

          {product.storeName && (
            <p className="text-[11px] text-gray-400 truncate">{product.storeName}</p>
          )}

          <p className="text-xs text-gray-500">{AGE_RANGE_LABEL}</p>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(rental.rentalPricePerDay)}
                <span className="text-xs font-normal text-gray-400">/day</span>
              </p>
              <p className="text-[11px] text-gray-400">
                Deposit {formatCurrency(rental.deposit)}
              </p>
            </div>
          </div>

          <Button size="sm" className="w-full mt-1">
            Request Rental
          </Button>
        </div>
      </div>
    </Link>
  );
}
