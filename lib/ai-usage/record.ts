/**
 * AI usage recorder — writes one AiUsageEvent per billable AI API call.
 *
 * Fire-and-forget and never-throw, mirroring lib/model-gen/generation-record.ts:
 * a logging failure must never break (or slow) an AI request. Call this at every
 * AI call site, on BOTH success and failure — a failed call (e.g. a 429) still
 * costs latency and is a signal worth keeping.
 *
 * The estimate is computed here from lib/ai-usage/pricing.ts and stamped with
 * PRICING_VERSION; the raw drivers are stored too, so rows can be re-priced.
 *
 * RULE FOR NEW AI FEATURES: every new AI call site must call recordAiUsage with
 * a stable `feature` string. The schema is feature-agnostic (free-text), so this
 * is the only step needed to make a new feature show up in cost reports.
 */
import { db } from "@/lib/db";
import { estimateCostUsd, PRICING_VERSION } from "./pricing";

export type AiUsageStatus = "success" | "error";

/**
 * Attribution context threaded from a route/engine down into a shared generation
 * function, so the function can record usage under the right feature and store.
 * `feature` is what makes one physical call (e.g. Vertex VTO) record as "tryon"
 * vs "catalogue" depending on who invoked it.
 */
export interface AiUsageContext {
  feature: string;
  storeId?: string | null;
  userId?: string | null;
}

export interface AiUsageInput {
  provider: string;
  model: string;
  /** Stable feature key, e.g. "tryon" | "catalogue" | "metadata_extract". */
  feature: string;
  /** Optional sub-type — a view id, objective, etc. */
  operation?: string | null;

  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;

  imagesGenerated?: number | null;
  imageInputs?: number | null;

  requestBytes?: number | null;
  responseBytes?: number | null;
  durationMs?: number | null;

  storeId?: string | null;
  userId?: string | null;
  productId?: string | null;

  status?: AiUsageStatus;
  errorMessage?: string | null;

  /** Provider-specific extras (resolution, finishReason, dims …). */
  metadata?: Record<string, unknown> | null;
}

/** Truncate provider error text so a verbose body never bloats the row. */
function clampError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  return msg.length > 500 ? msg.slice(0, 500) : msg;
}

/**
 * Persist one usage event. Non-blocking and non-fatal — returns immediately on
 * any failure. Awaiting is optional; callers in fire-and-forget paths may ignore
 * the returned promise.
 */
export async function recordAiUsage(input: AiUsageInput): Promise<void> {
  try {
    const totalTokens =
      input.totalTokens ??
      (input.inputTokens != null || input.outputTokens != null
        ? (input.inputTokens ?? 0) + (input.outputTokens ?? 0)
        : null);

    const estimatedCostUsd = estimateCostUsd(input.model, {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      imagesGenerated: input.imagesGenerated,
    });

    await db.aiUsageEvent.create({
      data: {
        provider: input.provider,
        model: input.model,
        feature: input.feature,
        operation: input.operation ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        totalTokens,
        imagesGenerated: input.imagesGenerated ?? 0,
        imageInputs: input.imageInputs ?? 0,
        requestBytes: input.requestBytes ?? null,
        responseBytes: input.responseBytes ?? null,
        durationMs: input.durationMs ?? null,
        estimatedCostUsd,
        pricingVersion: estimatedCostUsd != null ? PRICING_VERSION : null,
        storeId: input.storeId ?? null,
        userId: input.userId ?? null,
        productId: input.productId ?? null,
        status: input.status ?? "success",
        errorMessage: clampError(input.errorMessage),
        // Arbitrary JSON object → plain JSON string (not a string-array field,
        // so lib/serialize.ts does not apply).
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error("[ai-usage] failed to record:", err);
  }
}
