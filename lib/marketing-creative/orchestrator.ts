/**
 * createMarketingCreativeJob — mirrors lib/presenter-reel/orchestrator.ts's
 * create+enqueue-in-one-call shape, but with a real branch: the two fast,
 * fully-deterministic hero-source-modes (reuse-catalogue, product-only) run
 * the whole render pipeline INLINE and return an already-"complete" job;
 * only generate-new (a real paid AI call) goes through pg-boss, per the
 * confirmed project rule that AI generation must never be a blocking
 * synchronous call (see the plan's Context section).
 */
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type CreativeHeroRenderPayload } from "@/lib/queue/types";
import { resolveBrandCreativeProfile } from "@/lib/branding/creative-tier";
import { resolveHeroSourceMode } from "./hero-source";
import { resolveHeroImageSync } from "./hero-resolver";
import { buildDeterministicCopy } from "./copy";
import { runRenderPipeline } from "./render-pipeline";
import { resolveDefaultTemplateFamily } from "./templates";
import type { CanvasKey, ContentMode, CreativeObjective, PlatformHint, RequestedHeroSourceMode, TemplateFamily } from "./types";

export interface CreateMarketingCreativeJobInput {
  productId: string;
  userId: string;
  aspectRatios: CanvasKey[];
  objective: CreativeObjective;
  templateFamily?: TemplateFamily;
  contentMode?: ContentMode;
  heroSourceMode?: RequestedHeroSourceMode;
  platform?: PlatformHint;
}

function defaultContentMode(objective: CreativeObjective): ContentMode {
  return objective === "price_promotion" ? "price-led" : "aspirational";
}

export async function createMarketingCreativeJob(input: CreateMarketingCreativeJobInput): Promise<{ id: string }> {
  const product = await db.product.findFirst({
    where: { id: input.productId, userId: input.userId },
    select: {
      id: true,
      title: true,
      category: true,
      occasion: true,
      price: true,
      mrpPrice: true,
      discountPercent: true,
      material: true,
      imageUrl: true,
    },
  });
  if (!product) throw new Error(`Product ${input.productId} not found`);

  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: input.userId },
    select: { brandTier: true, priceVisibility: true, accentColor: true },
  });
  const brand = resolveBrandCreativeProfile(clientProfile);
  const accentColor = clientProfile?.accentColor ?? null;

  const templateFamily: TemplateFamily = input.templateFamily ?? resolveDefaultTemplateFamily(brand.brandTier);

  const requestedHeroSourceMode: RequestedHeroSourceMode = input.heroSourceMode ?? "auto";
  // priceVisibility "suppressed" overrides a requested price-led mode — the
  // Brand Creative Profile always wins over a single request (report Part 5.2).
  const contentMode: ContentMode =
    brand.priceVisibility === "suppressed" ? "aspirational" : input.contentMode ?? defaultContentMode(input.objective);

  const occasionTags = parseArray(product.occasion);
  const heroSourceMode = resolveHeroSourceMode({
    requestedMode: requestedHeroSourceMode,
    brandTier: brand.brandTier,
    priceVisibility: brand.priceVisibility,
    category: product.category,
    hasOccasionSignal: occasionTags.length > 0 || input.objective === "seasonal_occasion",
    objective: input.objective,
    contentMode,
    platform: input.platform,
  });

  const baseData = {
    userId: input.userId,
    productId: product.id,
    requestedHeroSourceMode,
    heroSourceMode,
    templateFamily,
    contentMode,
    objective: input.objective,
    platform: input.platform ?? null,
    aspectRatios: JSON.stringify(input.aspectRatios),
  };

  if (heroSourceMode === "generate-new") {
    const job = await db.marketingCreativeJob.create({
      data: { ...baseData, status: "queued" },
      select: { id: true },
    });
    const boss = await getBoss();
    const payload: CreativeHeroRenderPayload = {
      jobId: job.id,
      productId: product.id,
      userId: input.userId,
      objective: input.objective,
      contentMode,
      templateFamily,
      aspectRatios: input.aspectRatios,
      platform: input.platform,
    };
    await boss.send(QUEUES.CREATIVE_HERO_RENDER, payload);
    return job;
  }

  // Fast, fully-deterministic path — resolve + render inline, no queue.
  const resolution = await resolveHeroImageSync(heroSourceMode, product);
  if (!resolution.ok) {
    const job = await db.marketingCreativeJob.create({
      data: { ...baseData, status: "failed", errorMessage: "no_source_image_available" },
      select: { id: true },
    });
    return job;
  }

  const copy = buildDeterministicCopy(product, brand.priceVisibility, contentMode, input.objective, templateFamily);

  try {
    const outputs = await runRenderPipeline({
      productId: product.id,
      userId: input.userId,
      heroImageUrl: resolution.heroImageUrl,
      templateFamily,
      contentMode,
      copy,
      aspectRatios: input.aspectRatios,
      accentColor,
    });

    const job = await db.marketingCreativeJob.create({
      data: {
        ...baseData,
        heroSourceMode: resolution.resolvedMode,
        heroImageUrl: resolution.heroImageUrl,
        heroSourceProductImageId: resolution.heroSourceProductImageId,
        status: "complete",
        outputs: JSON.stringify(outputs),
      },
      select: { id: true },
    });
    return job;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const job = await db.marketingCreativeJob.create({
      data: {
        ...baseData,
        heroSourceMode: resolution.resolvedMode,
        heroImageUrl: resolution.heroImageUrl,
        status: "failed",
        errorMessage: message.slice(0, 500),
      },
      select: { id: true },
    });
    return job;
  }
}
