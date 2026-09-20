/**
 * AI Presenter Reel orchestrator — M4. Ties persona selection, M3's script
 * generation, and the M1 provider (via the M2 queue/worker) into the one
 * function the future Marketing Studio UI (M5) and the API route below it
 * both call.
 *
 * Deliberately simpler than lib/catalogue-motion/orchestrator.ts's
 * createMotionJob/startMotionJob split: that split exists because a motion
 * job resolves a multi-shot storyboard and creates several MotionClip rows
 * before anything renders. A presenter reel is a single clip end to end, so
 * "create" and "start" collapse into one function — there's no intermediate
 * state worth exposing separately.
 */
import { db } from "@/lib/db";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type PresenterRenderPayload } from "@/lib/queue/types";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import { generatePresenterScript, type ScriptProductInput } from "./script-generator";
import { nearestPresenterDuration } from "./provider/veo-presenter-provider";

// Same objective filter as lib/catalogue-motion/reel/reference-resolver.ts's
// GENERATED_OBJECTIVES — duplicated rather than imported (that constant is
// module-private, and reaching into the reel engine's internals would
// couple two modules meant to stay independent; see this module's own
// header and the plan's "leave the existing architecture untouched" note).
const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

const DEFAULT_DURATION_SEC = 8;

export interface CreatePresenterReelJobInput {
  productId: string;
  userId: string;
  personaId: string;
  durationSec?: number;
}

/**
 * A product's existing generated on-model front photo — never the raw
 * upload. See research/reel-engine-components.html's Component 9: animating
 * a flat, un-generated original produced a garment with a different, more
 * ornate pattern than the real product, because it asks the model to invent
 * the drape and the scene at once instead of animating a photo where
 * correct draping is already solved. Same rule this module's provider
 * relies on, enforced here rather than left to the caller.
 */
async function findGeneratedFrontPhoto(productId: string): Promise<string | undefined> {
  const row = await db.productImage.findFirst({
    where: { productId, view: "front", objective: { in: GENERATED_OBJECTIVES } },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  // ProductImage.url has retailer branding baked into the stored Cloudinary
  // URL — strip back to the clean base before Veo ever sees it (the same
  // fix already shipped for the reel engine after it shipped without it).
  return row ? stripDeliveryTransforms(row.url) : undefined;
}

export async function createPresenterReelJob(input: CreatePresenterReelJobInput): Promise<{ id: string }> {
  const product = await db.product.findFirst({
    where: { id: input.productId, userId: input.userId },
    select: { id: true, title: true, category: true, color: true, material: true, pattern: true, detailNotes: true, occasion: true, price: true },
  });
  if (!product) throw new Error(`Product ${input.productId} not found`);

  const persona = await db.presenterPersona.findFirst({ where: { id: input.personaId, deletedAt: null } });
  if (!persona) throw new Error(`Persona ${input.personaId} not found`);

  const sourceImageUrl = await findGeneratedFrontPhoto(product.id);
  if (!sourceImageUrl) {
    throw new Error("No generated on-model photo exists for this product yet — generate one first, then try again.");
  }

  const scriptInput: ScriptProductInput = {
    title: product.title,
    category: product.category,
    color: product.color,
    material: product.material,
    pattern: product.pattern,
    detailNotes: product.detailNotes,
    occasion: product.occasion,
    price: product.price,
  };
  const script = await generatePresenterScript(scriptInput, { feature: "presenter_reel", userId: input.userId });

  const durationSec = nearestPresenterDuration(input.durationSec ?? DEFAULT_DURATION_SEC);

  const job = await db.presenterReelJob.create({
    data: { userId: input.userId, productId: product.id, personaId: persona.id, script, status: "queued" },
    select: { id: true },
  });

  const boss = await getBoss();
  const payload: PresenterRenderPayload = {
    jobId: job.id,
    sourceImageUrl,
    script,
    durationSec,
    userId: input.userId,
    productId: product.id,
  };
  await boss.send(QUEUES.PRESENTER_RENDER, payload);

  return job;
}
