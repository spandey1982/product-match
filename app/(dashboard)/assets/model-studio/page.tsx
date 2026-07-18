import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { listModelProfiles } from "@/lib/model-gen/casting";
import { getFace, type FaceEntry } from "@/lib/model-gen/faces";
import { listAvailableFaces } from "@/lib/model-gen/faces-loader";
import { ModelStudioView, type SignatureModelSummary } from "./ModelStudioView";

export const metadata: Metadata = { title: "Model Studio | Mentis" };

/**
 * Server entry for Model Studio — resolves the current retailer's Signature
 * Models and hands them off to the client component along with the face
 * library. Only faces whose portrait assets are on disk are exposed to the
 * picker (see listAvailableFaces); the retailer sees N cards when N ship,
 * never gradient placeholders for un-generated ids.
 *
 * No paid AI calls happen here or anywhere on this page: Signature Models
 * are configs, not generated images.
 */
export default async function ModelStudioPage() {
  const session = await requireAuth();
  const [profiles, availableFaces] = await Promise.all([
    listModelProfiles(session.id),
    listAvailableFaces(),
  ]);

  // Ensure any face referenced by an existing profile stays visible in the
  // picker even if its asset was renamed/legacy'd since the profile was
  // saved — the retailer needs to see what they picked before.
  const availableIds = new Set(availableFaces.map((f) => f.id));
  const referencedFaces: FaceEntry[] = [];
  for (const p of profiles) {
    if (availableIds.has(p.faceId)) continue;
    const face = getFace(p.faceId);
    if (face) {
      referencedFaces.push(face);
      availableIds.add(face.id);
    }
  }
  const faces = [...availableFaces, ...referencedFaces];

  const initial: SignatureModelSummary[] = profiles.map((p) => {
    const face = getFace(p.faceId);
    return {
      id: p.id,
      name: p.name,
      faceId: p.faceId,
      faceLabel: face?.label ?? null,
      faceThumbnailUrl: face?.thumbnailUrl ?? null,
      metadata: p.metadata,
      poseMode: p.poseMode,
    };
  });

  return <ModelStudioView initialProfiles={initial} faceLibrary={faces} />;
}
