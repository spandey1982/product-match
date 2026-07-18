/**
 * Signature Model CRUD — list + create.
 *
 * All endpoints go through lib/model-gen/casting.ts so ownership, face-id
 * validation and soft-delete semantics stay in one place. Every route is
 * auth-gated. The Casting flag (ENABLE_AI_CASTING) does NOT gate reads/writes
 * here — a retailer can prep Signature Models even if the flag hasn't been
 * flipped on yet; the flag only controls whether the engine consumes them.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listModelProfiles,
  createModelProfile,
  type ModelProfileInput,
} from "@/lib/model-gen/casting";
import {
  EMPTY_METADATA,
  isPoseMode,
  parseCastingMetadata,
  type CastingMetadata,
} from "@/lib/model-gen/casting-types";
import { isFaceId, getFace } from "@/lib/model-gen/faces";

/** Slim payload for the UI — never leaks internal fields (deletedAt, updatedAt). */
function toWire(p: Awaited<ReturnType<typeof listModelProfiles>>[number]) {
  const face = getFace(p.faceId);
  return {
    id: p.id,
    name: p.name,
    faceId: p.faceId,
    faceLabel: face?.label ?? null,
    faceThumbnailUrl: face?.thumbnailUrl ?? null,
    metadata: p.metadata,
    poseMode: p.poseMode,
    createdAt: p.createdAt.toISOString(),
  };
}

// GET /api/model-profiles — list this retailer's active Signature Models.
export async function GET() {
  try {
    const session = await requireAuth();
    const profiles = await listModelProfiles(session.id);
    return NextResponse.json({ profiles: profiles.map(toWire) });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Coerce a client-supplied metadata blob into a CastingMetadata. Unknown /
 * missing fields collapse to null (smart-pick) rather than throwing — this
 * matches the resolver's "null = smart-pick" contract and keeps the API
 * forward-compatible with future fields.
 */
function coerceMetadata(raw: unknown): CastingMetadata {
  if (raw && typeof raw === "object") {
    return parseCastingMetadata(JSON.stringify(raw));
  }
  return { ...EMPTY_METADATA };
}

// POST /api/model-profiles — create a new Signature Model.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const nameRaw = (body as { name?: unknown }).name;
    const faceIdRaw = (body as { faceId?: unknown }).faceId;
    const poseModeRaw = (body as { poseMode?: unknown }).poseMode;

    if (typeof nameRaw !== "string" || !nameRaw.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (typeof faceIdRaw !== "string" || !isFaceId(faceIdRaw)) {
      return NextResponse.json({ error: "Invalid faceId" }, { status: 400 });
    }

    const input: ModelProfileInput = {
      name: nameRaw,
      faceId: faceIdRaw,
      metadata: coerceMetadata((body as { metadata?: unknown }).metadata),
      poseMode: isPoseMode(poseModeRaw) ? poseModeRaw : null,
    };

    const created = await createModelProfile(session.id, input);
    return NextResponse.json({ profile: toWire(created) }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Validation errors from the DB layer surface as 400s rather than 500s.
    const message = (err as Error).message;
    if (
      message.startsWith("Signature Model") ||
      message.startsWith("Unknown face") ||
      message.startsWith("Name must") ||
      message.startsWith("Maximum ")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
