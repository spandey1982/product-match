"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Palette, Shirt, Layers, Crown, IndianRupee, Tag, Calendar } from "lucide-react";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { HybridImageCarousel } from "@/components/product/HybridImageCarousel";
import { AdditionalInfoSlide } from "@/components/product/AdditionalInfoSlide";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductImageViewer } from "@/components/product/ProductImageViewer";
import { getProductCardFramedImages, getProductCardImageLabels } from "@/lib/product/card-images";
import { displayUrl, masterUrl, thumbnailUrl, zoomedUrl } from "@/lib/images/variants";
import { WishlistButton } from "@/components/shop/WishlistButton";
import { ShopTryOnButton } from "@/components/shop/ShopTryOnButton";
import { StoreLocationCard } from "@/components/rental/StoreLocationCard";
import { HomeTrialRequestModal } from "@/components/shop/HomeTrialRequestModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCell, FieldRow, FieldValue } from "@/components/product/InfoCell";
import { formatLabel } from "@/lib/product-detail/format";
import { colorSwatchHex, colorDescriptor } from "@/lib/product-detail/color-presentation";
import { materialDescriptor, occasionDescriptor, categoryDescriptor, styleValue } from "@/lib/product-detail/descriptors";
import { CustomerAddress } from "@/lib/rental/customer-profile";
import { cn } from "@/lib/utils";

/**
 * Public, read-only /shop product detail view — modeled on the retailer's
 * own ProductDetailView (the one with Product Information + "Pairs
 * beautifully with" cards) minus every retailer-only control
 * (edit/delete/generate-image/download/erase-region), same posture
 * RentalProductDetailView already took for /rent. "Try & Buy" (opens
 * HomeTrialRequestModal, creating a ShopOrder with orderType "trial" — a
 * home-trial request, not a real purchase and not a rental) is the page's
 * sole primary action (right after the store card) — per explicit direction
 * there is no separate purchase/checkout CTA here. ShopCheckoutModal/the
 * /shop/orders confirmation page still exist but nothing on this page
 * triggers them anymore. Uniform for every product, not conditioned on
 * isForRent. HomeTrialRequestModal is a genuine fork of
 * components/rental/RentalRequestModal.tsx, not a shared component — see
 * ShopOrder's doc comment in prisma/schema.prisma for why this flow no
 * longer reuses RentalOrder/RentalRequestModal at all (it used to; that
 * conflated a product-sale home trial with the real /rent marketplace).
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

  // Same trailing-raw-upload trim as /rent's PDP — but framed only (no size
  // variant baked in yet), so display/master/thumbnail can each be derived
  // from the same base without chaining a second downscale on top of a
  // first (which is what made these images look soft before).
  const framedImages = getProductCardFramedImages(product);
  const cardImageLabels = getProductCardImageLabels(product);
  const hasTrailingRawImage = Boolean(product.imageUrl) && framedImages.length > 1;
  const realFramedImages = hasTrailingRawImage ? framedImages.slice(0, -1) : framedImages;
  const realLabels = hasTrailingRawImage ? cardImageLabels.slice(0, -1) : cardImageLabels;

  const displayImages = realFramedImages.map(displayUrl); // main carousel
  const masterImages = realFramedImages.map(masterUrl); // full-screen viewer
  const thumbImages = realFramedImages.map(thumbnailUrl); // rail thumbnails

  // "Additional Info" occupies logical slot 2 (after front, back) — clamped
  // so a product with fewer than 2 real images still gets it appended, not
  // an out-of-range slot.
  const infoSlot = Math.min(2, realFramedImages.length);
  const totalSlots = realFramedImages.length + 1;
  const [activeSlot, setActiveSlot] = useState(0);

  function realIndexForSlot(slot: number): number {
    return slot < infoSlot ? slot : slot - 1;
  }

  const safeActiveSlot = Math.min(activeSlot, Math.max(totalSlots - 1, 0));
  const isInfoSlideActive = safeActiveSlot === infoSlot && realFramedImages.length > 0;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [trialModalOpen, setTrialModalOpen] = useState(false);

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
                            slot === safeActiveSlot ? "border-indigo-500 ring-2 ring-indigo-100" : "border-transparent"
                          )}
                        >
                          {/* Same slide as the main carousel, scaled down to fit the
                              thumbnail — content spans the full width here rather than
                              being confined to the left half, so it keeps as much room
                              as it can once shrunk this far. */}
                          <div className="absolute top-0 left-0 w-[300px] h-[400px] origin-top-left scale-[0.1867] sm:scale-[0.2133] pointer-events-none">
                            <AdditionalInfoSlide
                              imageUrl={zoomedUrl(realFramedImages[0])}
                              title={product.title}
                              color={product.color}
                              fullWidthContent
                            />
                          </div>
                        </button>
                      );
                    }
                    const realIndex = realIndexForSlot(slot);
                    return (
                      <button
                        key={`${thumbImages[realIndex]}-${slot}`}
                        type="button"
                        onClick={() => setActiveSlot(slot)}
                        aria-label={`View ${realLabels[realIndex] ?? `image ${realIndex + 1}`}`}
                        aria-current={slot === safeActiveSlot}
                        className={cn(
                          "relative w-14 sm:w-16 aspect-[3/4] shrink-0 rounded-xl overflow-hidden bg-gray-50 border-2 transition-colors",
                          slot === safeActiveSlot ? "border-indigo-500 ring-2 ring-indigo-100" : "border-transparent"
                        )}
                      >
                        <ProductImage src={thumbImages[realIndex]} title={product.title} category={product.category} className="w-full h-full" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100 flex-1 min-w-0">
                <HybridImageCarousel
                  images={displayImages}
                  labels={realLabels}
                  title={product.title}
                  category={product.category}
                  className="w-full h-full"
                  infoSlot={infoSlot}
                  renderInfoSlide={() => (
                    <AdditionalInfoSlide
                      imageUrl={zoomedUrl(realFramedImages[0])}
                      title={product.title}
                      color={product.color}
                    />
                  )}
                  activeSlot={safeActiveSlot}
                  onActiveSlotChange={setActiveSlot}
                  onImageClick={(realIndex) => setViewerIndex(realIndex)}
                />
                <div className="absolute top-3 right-3 z-30">
                  <WishlistButton productId={product.id} initialWishlisted={initialWishlisted} loggedIn={loggedIn} />
                </div>

                {!isInfoSlideActive && (
                  <div className="absolute bottom-3 left-3 z-30">
                    <ShopTryOnButton
                      product={product}
                      loggedIn={loggedIn}
                      initialCredits={initialTryOnCredits}
                      myTryOnsHref="/shop/my-try-ons"
                      iconOnly
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Product details */}
          <div className="flex flex-col gap-5">
            <div className="space-y-3">
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

              <div className="flex items-baseline gap-2 pt-1">
                <div className="flex items-center gap-0.5 text-gray-800">
                  <IndianRupee className="h-5 w-5" strokeWidth={1.75} />
                  <span className="font-body text-xl sm:text-2xl font-semibold">
                    {product.price.toLocaleString("en-IN")}
                  </span>
                </div>
                {product.mrpPrice != null && product.mrpPrice > product.price && (
                  <span className="font-body text-sm text-gray-400 line-through">
                    ₹{product.mrpPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>

            {hasStoreContact && (
              <StoreLocationCard storeName={product.storeName} phone={product.storePhone} address={product.storeAddress} collapsible />
            )}

            <Button size="lg" className="w-full" onClick={() => setTrialModalOpen(true)}>
              Try & Buy
            </Button>

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
                <FieldRow>
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
                <FieldRow last>
                  <InfoCell icon={Tag} label="Craft / Specialty">
                    <FieldValue value={product.pattern ? formatLabel(product.pattern) : "—"} />
                  </InfoCell>
                  <InfoCell icon={Calendar} label="Occasions">
                    <FieldValue
                      value={product.occasion.length > 0 ? product.occasion.map(formatLabel).join(", ") : "—"}
                      descriptor={occasionDescriptor(product.occasion)}
                    />
                  </InfoCell>
                </FieldRow>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {viewerIndex !== null && masterImages.length > 0 && (
        <ProductImageViewer
          images={masterImages}
          labels={realLabels}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {trialModalOpen && (
        <HomeTrialRequestModal
          productId={product.id}
          productTitle={product.title}
          productImage={thumbImages[0] ?? null}
          storeName={product.storeName}
          price={product.price}
          size={product.size}
          sessionPhone={sessionPhone}
          initialAccount={initialAccount}
          initialAddresses={initialAddresses}
          onClose={() => setTrialModalOpen(false)}
        />
      )}
    </div>
  );
}
