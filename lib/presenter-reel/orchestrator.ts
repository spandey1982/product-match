/**
 * AI Presenter Reel orchestrator — ties persona selection, script
 * generation, the deterministic end card (hook_end_card delivery mode),
 * and the queue/worker together into the functions the Marketing Studio UI
 * and API routes call.
 *
 * Deliberately simpler than lib/catalogue-motion/orchestrator.ts's
 * createMotionJob/startMotionJob split: that split exists because a motion
 * job resolves a multi-shot storyboard and creates several MotionClip rows
 * before anything renders. A presenter reel is a single clip end to end, so
 * "create" and "start" collapse into one function.
 *
 * Two entry points now, not one, per the content-strategy upgrade's
 * "editable script" decision: previewPresenterScript() generates a script
 * WITHOUT creating a job or spending a Veo call (cheap Gemini text call
 * only), so the Studio UI can show it for editing first; createPresenterReelJob()
 * takes the (possibly retailer-edited) final script and does the real,
 * billed enqueue.
 */
import { db } from "@/lib/db";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type PresenterRenderPayload } from "@/lib/queue/types";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import { generatePresenterScript, type ScriptProductInput } from "./script-generator";
import { buildEndCardContent } from "./end-card";
import { nearestPresenterDuration } from "./provider/veo-presenter-provider";
import { wordBudgetFor, charLimitFor, ALLOWED_DURATIONS, type DeliveryMode, type CtaMode, type TimingMode } from "./duration-budget";
import type { GarmentIntelligence } from "@/lib/garment-intelligence/types";

// Same objective filter as lib/catalogue-motion/reel/reference-resolver.ts's
// GENERATED_OBJECTIVES — duplicated rather than imported (module-private,
// and reaching into the reel engine's internals would couple two modules
// meant to stay independent).
const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

const DEFAULT_DURATION_SEC = 8;
const DEFAULT_TEMPLATE_ID = "value_trust" as const;

interface ResolvedProduct {
  id: string;
  title: string;
  category: string;
  color: string;
  material: string | null;
  pattern: string | null;
  detailNotes: string | null;
  occasion: string | null;
  price: number;
  mrpPrice: number | null;
  discountPercent: number | null;
}

/** A product's existing generated on-model front photo — see research/reel-engine-components.html's Component 9 for why never the raw upload. */
async function findGeneratedFrontPhoto(productId: string): Promise<string | undefined> {
  const row = await db.productImage.findFirst({
    where: { productId, view: "front", objective: { in: GENERATED_OBJECTIVES } },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  return row ? stripDeliveryTransforms(row.url) : undefined;
}

async function resolveProduct(productId: string, userId: string): Promise<ResolvedProduct> {
  const product = await db.product.findFirst({
    where: { id: productId, userId },
    select: {
      id: true, title: true, category: true, color: true, material: true, pattern: true,
      detailNotes: true, occasion: true, price: true, mrpPrice: true, discountPercent: true,
    },
  });
  if (!product) throw new Error(`Product ${productId} not found`);
  return product;
}

/** Same try/catch-and-degrade parse pattern used throughout the codebase for GI's JSON-string column — a missing/malformed row is a normal, expected case, not an error. */
async function fetchGiHighlights(productId: string): Promise<string[]> {
  const gi = await db.garmentIntelligence.findUnique({ where: { productId }, select: { data: true } });
  if (!gi) return [];
  try {
    const data = JSON.parse(gi.data) as GarmentIntelligence;
    return (data.craftsmanship?.highlights ?? []).filter((h) => h.trim().length > 0);
  } catch {
    return [];
  }
}

function validatedDuration(requested: number | undefined): (typeof ALLOWED_DURATIONS)[number] {
  const nearest = nearestPresenterDuration(requested ?? DEFAULT_DURATION_SEC);
  return ALLOWED_DURATIONS.includes(nearest as (typeof ALLOWED_DURATIONS)[number])
    ? (nearest as (typeof ALLOWED_DURATIONS)[number])
    : DEFAULT_DURATION_SEC;
}

export interface PreviewPresenterScriptInput {
  productId: string;
  userId: string;
  durationSec?: number;
  deliveryMode?: DeliveryMode;
  ctaMode?: CtaMode;
  ctaText?: string | null;
  timingMode?: TimingMode;
}

export interface PreviewPresenterScriptResult {
  script: string;
  wordBudget: number;
  charLimit: number;
  durationSec: number;
}

/** Generates a script for the Studio UI's review/edit step — no job row, no queue send, no Veo cost. Just the (cheap) Gemini text call. */
export async function previewPresenterScript(input: PreviewPresenterScriptInput): Promise<PreviewPresenterScriptResult> {
  const product = await resolveProduct(input.productId, input.userId);
  const durationSec = validatedDuration(input.durationSec);
  const deliveryMode = input.deliveryMode ?? "full_script";
  const ctaMode = input.ctaMode ?? "on_screen";
  const timingMode = input.timingMode ?? "smart";

  const giHighlights = await fetchGiHighlights(product.id);
  const scriptInput: ScriptProductInput = {
    title: product.title, category: product.category, color: product.color,
    material: product.material, pattern: product.pattern, detailNotes: product.detailNotes,
    occasion: product.occasion, price: product.price, giHighlights,
  };

  const script = await generatePresenterScript(
    scriptInput,
    { durationSec, deliveryMode, ctaMode, ctaText: input.ctaText, timingMode },
    { feature: "presenter_reel", userId: input.userId }
  );

  return {
    script,
    wordBudget: wordBudgetFor(durationSec, deliveryMode, ctaMode, timingMode),
    charLimit: charLimitFor(durationSec, deliveryMode, ctaMode, timingMode),
    durationSec,
  };
}

export interface CreatePresenterReelJobInput {
  productId: string;
  userId: string;
  personaId: string;
  durationSec?: number;
  templateId?: string;
  deliveryMode?: DeliveryMode;
  ctaMode?: CtaMode;
  ctaText?: string | null;
  timingMode?: TimingMode;
  /** The final script to render — normally the (possibly retailer-edited) result of a prior previewPresenterScript() call. Falls back to generating fresh if omitted, so direct/scripted callers (verify scripts, tests) keep working unchanged. */
  script?: string;
}

export async function createPresenterReelJob(input: CreatePresenterReelJobInput): Promise<{ id: string }> {
  const product = await resolveProduct(input.productId, input.userId);

  const persona = await db.presenterPersona.findFirst({ where: { id: input.personaId, deletedAt: null } });
  if (!persona) throw new Error(`Persona ${input.personaId} not found`);

  const sourceImageUrl = await findGeneratedFrontPhoto(product.id);
  if (!sourceImageUrl) {
    throw new Error("No generated on-model photo exists for this product yet — generate one first, then try again.");
  }

  const durationSec = validatedDuration(input.durationSec);
  const deliveryMode = input.deliveryMode ?? "full_script";
  const ctaMode = input.ctaMode ?? "on_screen";
  const timingMode = input.timingMode ?? "smart";
  const templateId = input.templateId ?? DEFAULT_TEMPLATE_ID;
  // Never trust client-supplied CTA copy as authoritative when ctaMode is
  // "none" — clear it server-side regardless of what the request sent.
  const ctaText = ctaMode === "none" ? null : (input.ctaText?.trim() || null);

  let script = input.script?.trim();
  if (!script) {
    const giHighlights = await fetchGiHighlights(product.id);
    const scriptInput: ScriptProductInput = {
      title: product.title, category: product.category, color: product.color,
      material: product.material, pattern: product.pattern, detailNotes: product.detailNotes,
      occasion: product.occasion, price: product.price, giHighlights,
    };
    script = await generatePresenterScript(
      scriptInput,
      { durationSec, deliveryMode, ctaMode, ctaText, timingMode },
      { feature: "presenter_reel", userId: input.userId }
    );
  }

  const endCardContent =
    deliveryMode === "hook_end_card"
      ? await buildEndCardContent(
          {
            id: product.id,
            userId: input.userId,
            title: product.title,
            price: product.price,
            mrpPrice: product.mrpPrice,
            discountPercent: product.discountPercent,
            material: product.material,
            pattern: product.pattern,
          },
          ctaMode,
          ctaText
        )
      : null;

  const job = await db.presenterReelJob.create({
    data: {
      userId: input.userId,
      productId: product.id,
      personaId: persona.id,
      script,
      status: "queued",
      templateId,
      durationSec,
      ctaMode,
      ctaText,
      deliveryMode,
      endingTimingMode: timingMode,
      endCardData: endCardContent ? JSON.stringify(endCardContent) : null,
    },
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
