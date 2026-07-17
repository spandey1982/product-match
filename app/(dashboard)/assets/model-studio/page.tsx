import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { listModelProfiles } from "@/lib/model-gen/casting";
import { FACE_LIBRARY, getFace } from "@/lib/model-gen/faces";
import { ModelStudioView, type SignatureModelSummary } from "./ModelStudioView";

export const metadata: Metadata = { title: "Model Studio | Mentis" };

/**
 * Server entry for Model Studio — resolves the current retailer's Signature
 * Models and hands them off to the client component along with the face
 * library (pure static data). No paid AI calls happen here or anywhere on
 * this page: Signature Models are configs, not generated images.
 */
export default async function ModelStudioPage() {
  const session = await requireAuth();
  const profiles = await listModelProfiles(session.id);

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

  return <ModelStudioView initialProfiles={initial} faceLibrary={[...FACE_LIBRARY]} />;
}
