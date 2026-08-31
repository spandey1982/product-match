/**
 * motion.qa job handler — two-stage quality check for one rendered clip.
 *
 * Stage 1 (algorithmic, no LLM) is the HARD gate: a corrupt/empty/wrong-
 * shaped file is rejected without spending a vision call. Stage 2 (vision
 * rubric) runs gemini-2.5-flash, not flash-lite — deliberately deviating
 * from lib/model-gen/ai-review.ts's model choice. ai-review is fire-and-
 * forget analytics that never gates a shipping decision; MotionQAResult.
 * verdict DOES gate whether a clip reaches compose, and this project's own
 * history already found the cheapest tier unreliable for exactly this kind
 * of fine visual judgment (see research/why-it-looks-ai.html and
 * PROJECT_KNOWLEDGE.md's garment-intelligence section).
 *
 * Because that judgment is still imperfect even one tier up, the accept/
 * reject band is deliberately WIDE, not a single midpoint: auto-accept only
 * >=4.5, auto-reject only <=2, everything between lands in manual_review —
 * which a human resolves via the minimal admin action (app/(dashboard)/
 * admin/motion-review/), not left to stall forever.
 */
import { db } from "@/lib/db";
import type { MotionQAPayload } from "@/lib/queue/types";
import { probeVideo, extractSampleFrames } from "../ffmpeg";
import { enqueueRenderForClip, maybeAdvanceToCompose } from "../orchestrator";
import { recordAiUsage } from "@/lib/ai-usage/record";

const REVIEW_MODEL = "gemini-2.5-flash";
const MAX_QA_RETRIES = 2;

const ACCEPT_THRESHOLD = 4.5;
const REJECT_THRESHOLD = 2;

const RUBRIC = `You are a strict fashion e-commerce video QA reviewer. You are shown three frames (start, middle, end) sampled from a short AI-generated product-motion clip, followed by the ORIGINAL static product photo it was generated from. Rate the clip from 1 (poor) to 5 (excellent). Return raw JSON only, no markdown:
{"identityConsistency":0,"garmentPreservation":0,"textureConsistency":0,"lightingStability":0,"backgroundStability":0,"motionSmoothness":0,"artifactScore":0,"overall":0,"issues":[]}
- identityConsistency: the model/subject looks like the same person/entity across all three frames, no identity drift
- garmentPreservation: the garment matches the original product photo in shape, cut and colour throughout
- textureConsistency: fabric texture/pattern stays consistent and doesn't warp or smear across frames
- lightingStability: lighting and background stay fixed, no unexplained shifts
- backgroundStability: the backdrop doesn't warp, jitter, or introduce new elements
- motionSmoothness: the implied motion between frames reads as smooth camera/garment movement, not a jarring jump or a frozen/static result
- artifactScore: INVERSE scale — 5 = no visible AI artifacts (warping, extra/missing limbs, melted detail), 1 = severe artifacts
- overall: holistic quality 1-5 — would this clip be usable in a real marketing video as-is
- issues: short array of any problems seen (empty array if none)`;

interface RawScores {
  identityConsistency?: unknown;
  garmentPreservation?: unknown;
  textureConsistency?: unknown;
  lightingStability?: unknown;
  backgroundStability?: unknown;
  motionSmoothness?: unknown;
  artifactScore?: unknown;
  overall?: unknown;
  issues?: unknown;
}

function score(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : null;
}

async function fetchImageBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { data, mime };
  } catch {
    return null;
  }
}

async function recordVerdict(
  clipId: string,
  jobId: string,
  data: { verdict: string; reviewModel: string; issues: string[]; scores?: Partial<Record<keyof RawScores, number | null>> }
): Promise<void> {
  await db.motionQAResult.upsert({
    where: { clipId },
    create: {
      clipId,
      verdict: data.verdict,
      reviewModel: data.reviewModel,
      issues: JSON.stringify(data.issues),
      identityConsistency: data.scores?.identityConsistency ?? null,
      garmentPreservation: data.scores?.garmentPreservation ?? null,
      textureConsistency: data.scores?.textureConsistency ?? null,
      lightingStability: data.scores?.lightingStability ?? null,
      backgroundStability: data.scores?.backgroundStability ?? null,
      motionSmoothness: data.scores?.motionSmoothness ?? null,
      artifactScore: data.scores?.artifactScore ?? null,
      overall: data.scores?.overall ?? null,
    },
    update: {
      verdict: data.verdict,
      reviewModel: data.reviewModel,
      issues: JSON.stringify(data.issues),
      identityConsistency: data.scores?.identityConsistency ?? null,
      garmentPreservation: data.scores?.garmentPreservation ?? null,
      textureConsistency: data.scores?.textureConsistency ?? null,
      lightingStability: data.scores?.lightingStability ?? null,
      backgroundStability: data.scores?.backgroundStability ?? null,
      motionSmoothness: data.scores?.motionSmoothness ?? null,
      artifactScore: data.scores?.artifactScore ?? null,
      overall: data.scores?.overall ?? null,
    },
  });

  if (data.verdict === "accepted") {
    await db.motionClip.update({ where: { id: clipId }, data: { status: "accepted" } });
    await maybeAdvanceToCompose(jobId);
    return;
  }
  if (data.verdict === "manual_review") {
    // Clip stays in "qa" status (already set by the render worker) — the
    // admin action resolves it explicitly rather than it stalling silently.
    // Deliberately does NOT call maybeAdvanceToCompose: a clip pending
    // human review is not a terminal state, so the check would just no-op
    // anyway, but skipping the call here says so explicitly.
    return;
  }
  // rejected — bounded regeneration, same plan, not a re-plan (see header).
  const clip = await db.motionClip.update({
    where: { id: clipId },
    data: { retryCount: { increment: 1 } },
    select: { retryCount: true },
  });
  if (clip.retryCount > MAX_QA_RETRIES) {
    await db.motionClip.update({ where: { id: clipId }, data: { status: "failed", errorMessage: "Rejected by QA after max retries" } });
    await maybeAdvanceToCompose(jobId);
    return;
  }
  await enqueueRenderForClip(clipId);
}

export async function handleMotionQA(payload: MotionQAPayload): Promise<void> {
  // Stage 1 — algorithmic hard gate, no LLM call.
  let probe;
  try {
    probe = await probeVideo(payload.clipUrl);
  } catch (err) {
    await recordVerdict(payload.clipId, payload.jobId, {
      verdict: "rejected",
      reviewModel: "stage1-algorithmic",
      issues: [`probe failed: ${err instanceof Error ? err.message : String(err)}`],
    });
    return;
  }
  if (!probe.hasVideoStream || probe.durationSec < 0.5 || probe.width === 0 || probe.height === 0) {
    await recordVerdict(payload.clipId, payload.jobId, {
      verdict: "rejected",
      reviewModel: "stage1-algorithmic",
      issues: ["invalid or corrupt video (no video stream, zero duration, or zero dimensions)"],
    });
    return;
  }

  // Stage 2 — vision rubric.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    // No reviewer available — fail safe to manual_review rather than silently accepting.
    await recordVerdict(payload.clipId, payload.jobId, {
      verdict: "manual_review",
      reviewModel: "unavailable",
      issues: ["GEMINI_API_KEY not configured — Stage 2 skipped"],
    });
    return;
  }

  const [frames, source] = await Promise.all([
    extractSampleFrames(payload.clipUrl, probe.durationSec),
    fetchImageBase64(payload.sourceImageUrl),
  ]);

  const parts: Array<Record<string, unknown>> = frames.map((f) => ({
    inline_data: { mime_type: "image/jpeg", data: f.toString("base64") },
  }));
  if (source) parts.push({ inline_data: { mime_type: source.mime, data: source.data } });
  parts.push({ text: RUBRIC });

  const imageInputs = frames.length + (source ? 1 : 0);
  const t0 = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${REVIEW_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1 } }),
    }
  );

  if (!res.ok) {
    void recordAiUsage({
      provider: "gemini", model: REVIEW_MODEL, feature: "catalogue_motion", operation: "qa_review",
      durationMs: Date.now() - t0, imageInputs, status: "error", errorMessage: `HTTP ${res.status}`,
      metadata: { clipId: payload.clipId },
    });
    await recordVerdict(payload.clipId, payload.jobId, {
      verdict: "manual_review",
      reviewModel: REVIEW_MODEL,
      issues: [`Stage 2 API error: HTTP ${res.status}`],
    });
    return;
  }

  const data = await res.json();
  const usageMeta = data.usageMetadata;
  void recordAiUsage({
    provider: "gemini", model: REVIEW_MODEL, feature: "catalogue_motion", operation: "qa_review",
    inputTokens: usageMeta?.promptTokenCount ?? null,
    outputTokens: usageMeta?.candidatesTokenCount ?? null,
    totalTokens: usageMeta?.totalTokenCount ?? null,
    durationMs: Date.now() - t0, imageInputs, status: "success",
    metadata: { clipId: payload.clipId },
  });
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let s: RawScores;
  try {
    s = JSON.parse(json) as RawScores;
  } catch {
    await recordVerdict(payload.clipId, payload.jobId, {
      verdict: "manual_review",
      reviewModel: REVIEW_MODEL,
      issues: ["Stage 2 returned unparsable output"],
    });
    return;
  }

  const overall = score(s.overall) ?? 0;
  const verdict = overall >= ACCEPT_THRESHOLD ? "accepted" : overall <= REJECT_THRESHOLD ? "rejected" : "manual_review";

  await recordVerdict(payload.clipId, payload.jobId, {
    verdict,
    reviewModel: REVIEW_MODEL,
    issues: Array.isArray(s.issues) ? s.issues.map(String) : [],
    scores: {
      identityConsistency: score(s.identityConsistency),
      garmentPreservation: score(s.garmentPreservation),
      textureConsistency: score(s.textureConsistency),
      lightingStability: score(s.lightingStability),
      backgroundStability: score(s.backgroundStability),
      motionSmoothness: score(s.motionSmoothness),
      artifactScore: score(s.artifactScore),
      overall: score(s.overall),
    },
  });
}
