/**
 * Signature Model persistence — the DB layer for retailer-owned casting briefs.
 *
 * A Signature Model is a saved *brief*, not a generated image (see the model
 * comment in prisma/schema.prisma). This module is the single place that reads
 * or writes `model_profiles`: it enforces ownership, validates the face-library
 * id, and treats delete as soft-delete so historical GenerationRecord rows stay
 * referenceable.
 *
 * There is no signature-model cap: configs cost nothing to store, and dropdown
 * clutter is a UI concern handled at the Studio surface (Phase C), not the
 * data layer.
 */
import { db } from "@/lib/db";
import { isFaceId } from "./faces";
import {
  parseCastingMetadata,
  serializeCastingMetadata,
  isPoseMode,
  type CastingMetadata,
  type PoseMode,
} from "./casting-types";

/**
 * Master switch for AI Casting UI + engine wiring. When OFF (default), the
 * upload flow, engine and Model Studio all behave exactly as before — the
 * schema, registry and scorer are inert code paths. Mirrors the pattern used
 * by ENABLE_AI_GEN_SETTINGS / ENABLE_SCENIC_COLLECTION / ENABLE_GARMENT_INTELLIGENCE.
 */
export function isAiCastingEnabled(): boolean {
  return process.env.ENABLE_AI_CASTING === "true";
}

/** Deserialized Signature Model — never leaks the raw JSON string. */
export interface ModelProfile {
  id: string;
  userId: string;
  name: string;
  faceId: string;
  metadata: CastingMetadata;
  poseMode: PoseMode | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Field payload for create — mirrors what Model Studio submits. */
export interface ModelProfileInput {
  name: string;
  faceId: string;
  metadata: CastingMetadata;
  poseMode: PoseMode | null;
}

interface RawRow {
  id: string;
  userId: string;
  name: string;
  faceId: string;
  metadata: string;
  poseMode: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function hydrate(row: RawRow): ModelProfile {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    faceId: row.faceId,
    metadata: parseCastingMetadata(row.metadata),
    poseMode: isPoseMode(row.poseMode) ? row.poseMode : null,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

const NAME_MIN = 1;
const NAME_MAX = 60;

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) throw new Error("Signature Model needs a name.");
  if (trimmed.length > NAME_MAX) throw new Error(`Name must be ${NAME_MAX} characters or fewer.`);
  return trimmed;
}

function validateFaceId(faceId: string): void {
  if (!isFaceId(faceId)) {
    throw new Error(`Unknown face reference: "${faceId}"`);
  }
}

function validatePoseMode(v: PoseMode | null): PoseMode | null {
  if (v === null) return null;
  if (!isPoseMode(v)) throw new Error(`Invalid pose mode: "${v}"`);
  return v;
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * Fetch one Signature Model by id, scoped to owner. Returns null if the id
 * is unknown, owned by someone else, or soft-deleted. Callers must handle
 * null explicitly — this function never throws on not-found.
 */
export async function getModelProfile(
  id: string,
  userId: string
): Promise<ModelProfile | null> {
  const row = await db.modelProfile.findFirst({
    where: { id, userId, deletedAt: null },
  });
  return row ? hydrate(row) : null;
}

/**
 * List a retailer's active Signature Models (soft-deleted excluded), newest
 * first. This is what Model Studio and the Add Product dropdown render.
 */
export async function listModelProfiles(userId: string): Promise<ModelProfile[]> {
  const rows = await db.modelProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(hydrate);
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function createModelProfile(
  userId: string,
  input: ModelProfileInput
): Promise<ModelProfile> {
  const name = validateName(input.name);
  validateFaceId(input.faceId);
  const poseMode = validatePoseMode(input.poseMode);

  const row = await db.modelProfile.create({
    data: {
      userId,
      name,
      faceId: input.faceId,
      metadata: serializeCastingMetadata(input.metadata),
      poseMode,
    },
  });
  return hydrate(row);
}

export async function updateModelProfile(
  id: string,
  userId: string,
  patch: Partial<ModelProfileInput>
): Promise<ModelProfile | null> {
  const existing = await getModelProfile(id, userId);
  if (!existing) return null;

  const data: {
    name?: string;
    faceId?: string;
    metadata?: string;
    poseMode?: PoseMode | null;
  } = {};

  if (patch.name !== undefined) data.name = validateName(patch.name);
  if (patch.faceId !== undefined) {
    validateFaceId(patch.faceId);
    data.faceId = patch.faceId;
  }
  if (patch.metadata !== undefined) {
    data.metadata = serializeCastingMetadata(patch.metadata);
  }
  if (patch.poseMode !== undefined) {
    data.poseMode = validatePoseMode(patch.poseMode);
  }

  const row = await db.modelProfile.update({
    where: { id },
    data,
  });
  return hydrate(row);
}

/**
 * Soft-delete a Signature Model. Never hard-deletes — historical
 * GenerationRecord rows keep referencing the profile id for explainability
 * and audit. Idempotent: deleting an already-deleted or unknown id returns
 * false without throwing.
 */
export async function softDeleteModelProfile(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await getModelProfile(id, userId);
  if (!existing) return false;
  await db.modelProfile.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
