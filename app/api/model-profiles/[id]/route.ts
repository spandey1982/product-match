/**
 * Signature Model — update + soft-delete.
 *
 * Ownership + face-id validation flow through lib/model-gen/casting.ts. Delete
 * is soft on purpose: historical GenerationRecord rows still reference the
 * profile id for explainability, so hard-delete would break audit. See the
 * ModelProfile schema comment for the policy.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getModelProfile,
  updateModelProfile,
  softDeleteModelProfile,
  type ModelProfileInput,
} from "@/lib/model-gen/casting";
import {
  isPoseMode,
  parseCastingMetadata,
} from "@/lib/model-gen/casting-types";
import { isFaceId, getFace } from "@/lib/model-gen/faces";

function toWire(p: Awaited<ReturnType<typeof getModelProfile>> & object) {
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

// PATCH /api/model-profiles/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const patch: Partial<ModelProfileInput> = {};

    if ("name" in body) {
      if (typeof body.name !== "string") {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      patch.name = body.name;
    }
    if ("faceId" in body) {
      if (typeof body.faceId !== "string" || !isFaceId(body.faceId)) {
        return NextResponse.json({ error: "Invalid faceId" }, { status: 400 });
      }
      patch.faceId = body.faceId;
    }
    if ("metadata" in body) {
      patch.metadata = parseCastingMetadata(JSON.stringify(body.metadata ?? {}));
    }
    if ("poseMode" in body) {
      if (body.poseMode !== null && !isPoseMode(body.poseMode)) {
        return NextResponse.json({ error: "Invalid poseMode" }, { status: 400 });
      }
      patch.poseMode = body.poseMode;
    }

    const updated = await updateModelProfile(id, session.id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ profile: toWire(updated) });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = (err as Error).message;
    if (message.startsWith("Signature Model") || message.startsWith("Unknown face") || message.startsWith("Name must")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/model-profiles/[id] — soft delete.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const ok = await softDeleteModelProfile(id, session.id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
