"use client";
import Link from "next/link";
import { ArrowLeft, Palette, Shirt, Layers, Crown } from "lucide-react";
import { PublicRentalProduct } from "@/lib/rental/public-product";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { getProductCardImages } from "@/lib/product/card-images";
import { RentalInfoPanel } from "@/components/rental/RentalInfoPanel";
import { getMockRentalInfo } from "@/lib/rental/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCell, FieldRow, FieldValue } from "@/components/product/InfoCell";
import { formatLabel } from "@/lib/product-detail/format";
import { colorSwatchHex, colorDescriptor } from "@/lib/product-detail/color-presentation";
import { materialDescriptor, categoryDescriptor, styleValue } from "@/lib/product-detail/descriptors";
import { CustomerAddress } from "@/lib/rental/customer-profile";

/**
 * Public, read-only rental detail view — the anonymous-visitor counterpart to
 * the retailer's ProductDetailView. Deliberately mirrors that page's
 * two-column shell (gradient wrapper, image card, right-column stack) rather
 * than a distinct layout — that structure was already settled there. No
 * edit/delete/generate-image/wishlist/try-on controls, since those are
 * retailer-only tooling behind /products/[id]; just enough product context to
 * decide whether to rent, plus the Request Rental flow.
 */
interface RentalProductDetailViewProps {
  product: PublicRentalProduct;
  /** Verified phone from the real OTP session, if the visitor is logged in. */
  sessionPhone?: string;
  /** Server-fetched for that same logged-in customer — never populated for a guest. */
  initialAccount?: { name: string; email?: string };
  initialAddresses?: CustomerAddress[];
}

export function RentalProductDetailView({
  product,
  sessionPhone,
  initialAccount,
  initialAddresses,
}: RentalProductDetailViewProps) {
  const rental = getMockRentalInfo(product);
  const styleInfo = styleValue(product.styleTags);
  const images = getProductCardImages(product);

  const badgeLabels = Array.from(
    new Set([
      ...product.occasion.slice(0, 2).map(formatLabel),
      ...(product.styleTags[0] ? [formatLabel(product.styleTags[0])] : []),
    ])
  ).slice(0, 3);

  return (
    <div>
      <Link
        href="/rent"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rent
      </Link>

      <div className="rounded-[2rem] bg-gradient-to-r from-transparent to-[#f7f4ef] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT — Image */}
          <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100">
            <ImageCarousel
              images={images}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent p-4 z-20 pointer-events-none">
              <Badge variant="purple" className="bg-white/90 text-indigo-700 backdrop-blur-sm">
                {product.category}
              </Badge>
            </div>
          </div>

          {/* RIGHT — Product details */}
          <div className="flex flex-col gap-5">
            <div className="space-y-3">
              {product.storeName && (
                <p className="text-xs text-gray-400">{product.storeName}</p>
              )}

              {badgeLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {badgeLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-700 font-body"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="font-heading text-3xl sm:text-4xl font-medium text-gray-900 leading-tight tracking-tight">
                {product.title}
              </h1>

              {product.description && (
                <p className="text-sm text-gray-500 leading-relaxed font-body max-w-prose">
                  {product.description}
                </p>
              )}

              <RentalInfoPanel
                productId={product.id}
                productTitle={product.title}
                productImage={images[0] ?? null}
                storeName={product.storeName}
                sessionPhone={sessionPhone}
                initialAccount={initialAccount}
                initialAddresses={initialAddresses}
                initialRental={rental}
                enableRequestFlow
              />
            </div>

            <Card className="rounded-3xl overflow-hidden bg-white/90">
              <CardHeader className="px-4 sm:px-5 pt-3.5 pb-1">
                <CardTitle className="font-heading text-base font-medium">Product Information</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <FieldRow>
                  <InfoCell icon={Palette} swatch={colorSwatchHex(product.color)} label="Color">
                    <FieldValue value={formatLabel(product.color)} descriptor={colorDescriptor(product.color)} />
                  </InfoCell>
                  <InfoCell icon={Shirt} label="Category">
                    <FieldValue
                      value={formatLabel(product.category)}
                      descriptor={categoryDescriptor(product.category, product.subcategory)}
                    />
                  </InfoCell>
                </FieldRow>
                <FieldRow last>
                  <InfoCell icon={Layers} label="Material">
                    <FieldValue
                      value={product.material ? formatLabel(product.material) : "—"}
                      descriptor={materialDescriptor(product.material)}
                    />
                  </InfoCell>
                  <InfoCell icon={Crown} label="Style">
                    <FieldValue value={styleInfo.value} descriptor={styleInfo.descriptor} />
                  </InfoCell>
                </FieldRow>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
