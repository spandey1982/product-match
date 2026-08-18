"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Palette, Shirt, Layers, Crown, IndianRupee, Sparkles } from "lucide-react";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { AdditionalInfoSlide } from "@/components/product/AdditionalInfoSlide";
import { ProductImage } from "@/components/product/ProductImage";
import { getProductCardImages, getProductCardImageLabels } from "@/lib/product/card-images";
import { zoomedUrl } from "@/lib/images/variants";
import { WishlistButton } from "@/components/shop/WishlistButton";
import { ShopCheckoutModal } from "@/components/shop/ShopCheckoutModal";
import { ShopTryOnButton } from "@/components/shop/ShopTryOnButton";
import { RentalInfoPanel } from "@/components/rental/RentalInfoPanel";
import { StoreLocationCard } from "@/components/rental/StoreLocationCard";
import { getMockRentalInfo } from "@/lib/rental/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCell, FieldRow, FieldValue } from "@/components/product/InfoCell";
import { formatLabel } from "@/lib/product-detail/format";
import { colorSwatchHex, colorDescriptor } from "@/lib/product-detail/color-presentation";
import { materialDescriptor, categoryDescriptor, styleValue } from "@/lib/product-detail/descriptors";
import { CustomerAddress } from "@/lib/rental/customer-profile";
import { cn } from "@/lib/utils";

/**
 * Public, read-only /shop product detail view — modeled on the retailer's
 * own ProductDetailView (the one with Product Information + "Pairs
 * beautifully with" cards) minus every retailer-only control
 * (edit/delete/generate-image/download/erase-region), same posture
 * RentalProductDetailView already took for /rent. Spans both buy and rent:
 * Buy always available, Rent (when the product is rental-enabled) reuses
 * RentalInfoPanel/RentalRequestModal exactly as /rent does — no reason to
 * fork that already-working flow for a plain purchase page.
 */
interface ShopProductDetailViewProps {
  product: PublicShopProduct;
  initialWishlisted: boolean;
  sessionPhone?: string;
  initialAccount?: { name: string; email?: string };
  initialAddresses?: CustomerAddress[];
  initialTryOnCredits: number;
}

export function ShopProductDetailView({
  product,
  initialWishlisted,
  sessionPhone,
  initialAccount,
  initialAddresses,
  initialTryOnCredits,
}: ShopProductDetailViewProps) {
  const loggedIn = Boolean(sessionPhone);
  const styleInfo = styleValue(product.styleTags);
  const rental = product.isForRent ? getMockRentalInfo(product) : null;

  // Same trailing-raw-upload trim as /rent's PDP.
  const cardImages = getProductCardImages(product);
  const cardImageLabels = getProductCardImageLabels(product);
  const hasTrailingRawImage = Boolean(product.imageUrl) && cardImages.length > 1;
  const realImages = hasTrailingRawImage ? cardImages.slice(0, -1) : cardImages;
  const realLabels = hasTrailingRawImage ? cardImageLabels.slice(0, -1) : cardImageLabels;

  // "Additional Info" occupies logical slot 2 (after front, back) — clamped
  // so a product with fewer than 2 real images still gets it appended, not
  // an out-of-range slot.
  const infoSlot = Math.min(2, realImages.length);
  const totalSlots = realImages.length + 1;
  const [activeSlot, setActiveSlot] = useState(0);

  function realIndexForSlot(slot: number): number {
    return slot < infoSlot ? slot : slot - 1;
  }
  function slotForRealIndex(realIndex: number): number {
    return realIndex < infoSlot ? realIndex : realIndex + 1;
  }

  const safeActiveSlot = Math.min(activeSlot, Math.max(totalSlots - 1, 0));
  const isInfoSlideActive = safeActiveSlot === infoSlot && realImages.length > 0;
  const activeRealIndex = Math.min(
    Math.max(realIndexForSlot(safeActiveSlot), 0),
    Math.max(realImages.length - 1, 0)
  );

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const badgeLabels = Array.from(
    new Set([
      ...product.occasion.slice(0, 2).map(formatLabel),
      ...(product.styleTags[0] ? [formatLabel(product.styleTags[0])] : []),
    ])
  ).slice(0, 3);

  const hasStoreContact = Boolean(product.storePhone || product.storeAddress);

  return (
    <div>
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      <div className="rounded-[2rem] bg-gradient-to-r from-transparent to-[#f7f4ef] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT — Image */}
          <div>
            <div className="flex flex-col-reverse lg:flex-row gap-3">
              {totalSlots > 1 && (
                <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
                  {Array.from({ length: totalSlots }).map((_, slot) => {
                    if (slot === infoSlot) {
                      return (
                        <button
                          key="info-slot"
                          type="button"
                          onClick={() => setActiveSlot(slot)}
                          aria-label="View Additional Info"
                          aria-current={slot === safeActiveSlot}
                          className={cn(
                            "relative w-14 sm:w-16 aspect-[3/4] shrink-0 rounded-xl overflow-hidden border-2 transition-colors",
                            "bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center",
                            slot === safeActiveSlot ? "border-indigo-500 ring-2 ring-indigo-100" : "border-transparent"
                          )}
                        >
                          <Sparkles className="h-4 w-4 text-white/80" />
                        </button>
                      );
                    }
                    const realIndex = realIndexForSlot(slot);
                    return (
                      <button
                        key={`${realImages[realIndex]}-${slot}`}
                        type="button"
                        onClick={() => setActiveSlot(slot)}
                        aria-label={`View ${realLabels[realIndex] ?? `image ${realIndex + 1}`}`}
                        aria-current={slot === safeActiveSlot}
                        className={cn(
                          "relative w-14 sm:w-16 aspect-[3/4] shrink-0 rounded-xl overflow-hidden bg-gray-50 border-2 transition-colors",
                          slot === safeActiveSlot ? "border-indigo-500 ring-2 ring-indigo-100" : "border-transparent"
                        )}
                      >
                        <ProductImage src={realImages[realIndex]} title={product.title} category={product.category} className="w-full h-full" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100 flex-1 min-w-0">
                {isInfoSlideActive ? (
                  <AdditionalInfoSlide
                    imageUrl={zoomedUrl(realImages[0])}
                    title={product.title}
                    color={product.color}
                  />
                ) : (
                  <ImageCarousel
                    images={realImages}
                    labels={realLabels}
                    title={product.title}
                    category={product.category}
                    className="w-full h-full"
                    index={activeRealIndex}
                    onIndexChange={(ri) => setActiveSlot(slotForRealIndex(ri))}
                  />
                )}
                {!isInfoSlideActive && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent p-4 z-20 pointer-events-none">
                    <Badge variant="purple" className="bg-white/90 text-indigo-700 backdrop-blur-sm">
                      {product.category}
                    </Badge>
                  </div>
                )}

                <div className="absolute top-3 right-3 z-30">
                  <WishlistButton productId={product.id} initialWishlisted={initialWishlisted} loggedIn={loggedIn} />
                </div>
              </div>
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

              <div className="flex items-center gap-0.5 text-gray-800 pt-1">
                <IndianRupee className="h-5 w-5" strokeWidth={1.75} />
                <span className="font-body text-xl sm:text-2xl font-semibold">
                  {product.price.toLocaleString("en-IN")}
                </span>
              </div>

              <Button size="lg" className="w-full" onClick={() => setCheckoutOpen(true)}>
                Buy Now
              </Button>

              {product.isForRent && rental && (
                <RentalInfoPanel
                  productId={product.id}
                  productTitle={product.title}
                  productImage={realImages[0] ?? null}
                  storeName={product.storeName}
                  sessionPhone={sessionPhone}
                  initialAccount={initialAccount}
                  initialAddresses={initialAddresses}
                  initialRental={rental}
                  enableRequestFlow
                />
              )}

              <ShopTryOnButton
                product={product}
                loggedIn={loggedIn}
                initialCredits={initialTryOnCredits}
                myTryOnsHref="/shop/my-try-ons"
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

            {hasStoreContact && (
              <StoreLocationCard storeName={product.storeName} phone={product.storePhone} address={product.storeAddress} />
            )}
          </div>
        </div>
      </div>

      {checkoutOpen && (
        <ShopCheckoutModal
          productId={product.id}
          productTitle={product.title}
          productImage={realImages[0] ?? null}
          storeName={product.storeName}
          unitPrice={product.price}
          sessionPhone={sessionPhone}
          initialAccount={initialAccount}
          initialAddresses={initialAddresses}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  );
}
