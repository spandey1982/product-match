/**
 * creative.hero-render job handler — the ONLY path in this feature that
 * calls a generative AI model. Reuses the existing model-gen engine
 * (lib/model-gen/engine.ts's generateModelImages, "scenic" backdrop — the
 * app's existing lifestyle/contextual-scene option, versus the plain
 * "studio" default) rather than building a new generation pipeline; that
 * call already handles its own billing internally (image_gen_1k/2k),
 * unlike presenter-reel's provider, so there's no separate charge/refund
 * step needed here.
 *
 * Once a new hero image exists, the rest of this handler runs the exact
 * same runRenderPipeline() the synchronous reuse-catalogue/product-only
 * path uses — the deterministic overlay step is identical regardless of
 * where the hero image came from.
 *
 * Pure handler function, no pg-boss import — worker/index.ts adapts
 * pg-boss v12's batch-array `.work()` calling convention, same pattern as
 * every other worker in this codebase.
 */
import { db } from "@/lib/db";
import type { CreativeHeroRenderPayload } from "@/lib/queue/types";
import { generateModelImages } from "@/lib/model-gen/engine";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import { resolveBrandCreativeProfile } from "@/lib/branding/creative-tier";
import { buildDeterministicCopy } from "../copy";
import { runRenderPipeline } from "../render-pipeline";
import type { CanvasKey, ContentMode, CreativeObjective, TemplateFamily } from "../types";

const MAX_RENDER_RETRIES = 2; // matches QUEUE_OPTIONS[CREATIVE_HERO_RENDER].retryLimit

// compositionClause (lib/model-gen/prompt-sets.ts) promises "the entire
// [open] half" as a MINIMUM (raised from a third 2026-09-24, along with an
// explicit ban on sharp/in-focus architectural detail in that half — see
// that clause's own header). Re-measured against two FRESH generations
// under that updated prompt (2026-09-24, both real hero photos, not
// synthetic): a kurti/indoor-boutique photo came back safe to ~55%, and —
// the harder case — a heavy, flared lehenga against a grand courtyard
// backdrop came back safe to ~51-54%, up from ~42-46% under the old
// prompt on the same category. The previously-sharp doorframe that used to
// sit right at the boundary is now a soft blurred drape instead. 0.45
// trusts this with a real margin below BOTH fresh measurements (6-9
// points), not pushed to either — live-tested (2026-09-24) at 0.45 against
// both photos directly (square + vertical, both categories): comfortable
// clearance before the model in every case. Still a single global
// constant, not category-aware — a lighter/simpler garment could likely
// trust a good deal more than this, but that needs the category-tiered
// backdrop work (proposed separately) rather than one shared number
// stretched to cover the hardest case. If compositionClause's wording
// changes again, re-measure and update this too.
const COMPOSITION_GUARANTEED_SAFE_FRACTION = 0.45;

export async function handleCreativeRender(payload: CreativeHeroRenderPayload): Promise<void> {
  const job = await db.marketingCreativeJob.findUnique({
    where: { id: payload.jobId },
    select: { id: true, userId: true, productId: true },
  });
  if (!job) {
    console.error(`[marketing-creative] job ${payload.jobId} not found — dropping`);
    return;
  }

  await db.marketingCreativeJob.update({ where: { id: payload.jobId }, data: { status: "rendering" } });

  try {
    const product = await db.product.findUnique({
      where: { id: job.productId },
      select: { id: true, title: true, category: true, price: true, mrpPrice: true, discountPercent: true, material: true },
    });
    if (!product) throw new Error("product_not_found");

    const clientProfile = await db.clientProfile.findUnique({
      where: { userId: job.userId },
      select: { brandTier: true, priceVisibility: true, accentColor: true },
    });
    const brand = resolveBrandCreativeProfile(clientProfile);
    const accentColor = clientProfile?.accentColor ?? null;

    const genResult = await generateModelImages({
      productId: product.id,
      userId: job.userId,
      objective: "catalogue",
      backdropSection: "scenic",
      // promo-benefits' text panel sits on the left, product zone on the
      // right (see lib/marketing-creative/renderer.tsx) — bias generation to
      // leave real open space on the left instead of relying solely on the
      // renderer's safe-zone scan to find whatever margin happens to exist.
      compositionHint: "right-third",
    });

    if (genResult.images.length === 0) {
      throw new Error(genResult.failure ?? "generation_failed");
    }
    const frontImage = genResult.images.find((i) => i.view === "front") ?? genResult.images[0];

    // persistGeneratedImages() (called inside generateModelImages) doesn't
    // return row ids — re-query the row it just created, same pattern
    // lib/presenter-reel/orchestrator.ts's findGeneratedFrontPhoto uses.
    const newRow = await db.productImage.findFirst({
      where: { productId: product.id, url: frontImage.url },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const heroImageUrl = stripDeliveryTransforms(frontImage.url);
    const contentMode = payload.contentMode as ContentMode;
    const objective = payload.objective as CreativeObjective;
    const templateFamily = payload.templateFamily as TemplateFamily;

    const copy = buildDeterministicCopy(product, brand.priceVisibility, contentMode, objective, templateFamily);

    const outputs = await runRenderPipeline({
      productId: product.id,
      userId: job.userId,
      heroImageUrl,
      templateFamily,
      contentMode,
      copy,
      aspectRatios: payload.aspectRatios as CanvasKey[],
      accentColor,
      guaranteedSafeFraction: COMPOSITION_GUARANTEED_SAFE_FRACTION,
    });

    await db.marketingCreativeJob.update({
      where: { id: payload.jobId },
      data: {
        status: "complete",
        heroImageUrl,
        heroSourceProductImageId: newRow?.id ?? null,
        provider: frontImage.provider ?? null,
        outputs: JSON.stringify(outputs),
      },
    });
  } catch (err) {
    await failOrRetry(payload, err);
  }
}

async function failOrRetry(payload: CreativeHeroRenderPayload, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const updated = await db.marketingCreativeJob.update({
    where: { id: payload.jobId },
    data: { retryCount: { increment: 1 } },
    select: { retryCount: true },
  });

  if (updated.retryCount > MAX_RENDER_RETRIES) {
    await db.marketingCreativeJob.update({
      where: { id: payload.jobId },
      data: { status: "failed", errorMessage: message.slice(0, 500) },
    });
    return; // terminal — do not rethrow, so pg-boss doesn't redeliver further
  }

  await db.marketingCreativeJob.update({
    where: { id: payload.jobId },
    data: { status: "queued", errorMessage: message.slice(0, 500) },
  });
  // Rethrow so pg-boss's own queue-level retry (QUEUE_OPTIONS[CREATIVE_HERO_RENDER]) redelivers.
  throw err;
}
