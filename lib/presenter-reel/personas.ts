/**
 * Presenter persona registry — the identity axis for the AI Presenter Reel,
 * mirroring lib/model-gen/faces.ts's FACE_LIBRARY pattern exactly and
 * deliberately reusing its face ids rather than maintaining a second,
 * parallel face list: a persona IS one of those same registry faces, plus
 * a voice. Registry-first, same as faces.ts — adding or removing a persona
 * is a code change, never a retailer upload (see PresenterPersona's schema
 * comment for why: curated stock only for v1, sidesteps consent/deepfake
 * risk entirely).
 *
 * This seeds the PresenterPersona table's initial rows (via
 * scripts/seed-presenter-personas.ts, not written yet as of M2) — this file
 * is the source of truth for what SHOULD exist, the DB rows are the actual
 * queryable copy the app reads from, same split as ModelProfile vs
 * FACE_LIBRARY.
 */
import { FACE_LIBRARY, type FaceEntry } from "@/lib/model-gen/faces";

export interface PersonaEntry {
  /** Stable id — becomes PresenterPersona.name's slug basis when seeding, not a DB id itself. */
  id: string;
  /** Retailer-facing display name — reuses the underlying face's own label for now (same identity, one name), not a separate persona-specific name yet. */
  name: string;
  faceRegistryId: FaceEntry["id"];
  /** Placeholder voice ids — Veo infers voice from the prompt's tone description today (see veo-presenter-provider.ts), not a selectable provider voice id yet. Kept as a field now so PresenterPersona's schema doesn't need a migration once real voice selection exists. */
  voiceProviderId: "warm-female-1" | "warm-male-1";
  language: string;
}

export const PERSONA_LIBRARY: PersonaEntry[] = FACE_LIBRARY.map((face) => ({
  id: face.id,
  name: face.label,
  faceRegistryId: face.id,
  voiceProviderId: face.sex === "female" ? "warm-female-1" : "warm-male-1",
  language: "en",
}));

export function getPersona(id: string): PersonaEntry | null {
  return PERSONA_LIBRARY.find((p) => p.id === id) ?? null;
}
