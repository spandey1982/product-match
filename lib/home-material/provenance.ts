/**
 * Field-level product provenance (HmProductEvidence) — Constitution
 * Principle 3 ("separate facts from inference") and the domain brief's
 * §14 Data Provenance section. Existed in the schema since Phase 1 with
 * nothing ever writing to it — this is what actually populates it.
 *
 * "Set latest evidence for this field" semantics, not append-only: no
 * unique constraint exists on (productId, field) in the schema, so a
 * naive re-seed would pile up duplicate rows for the same fact. Deletes
 * any prior evidence for the same field before inserting the fresh one.
 */
import { db } from "@/lib/db";

export type EvidenceSourceType =
  | "manufacturer"
  | "retailer"
  | "user"
  | "platform"
  | "ai_inferred"
  | "external_verified"
  | "unspecified";

export async function recordProductEvidence(params: {
  productId: string;
  field: string;
  value: string;
  sourceType: EvidenceSourceType;
  sourceDetail?: string | null;
  confidence?: number | null;
}): Promise<void> {
  await db.hmProductEvidence.deleteMany({ where: { productId: params.productId, field: params.field } });
  await db.hmProductEvidence.create({
    data: {
      productId: params.productId,
      field: params.field,
      value: params.value,
      sourceType: params.sourceType,
      sourceDetail: params.sourceDetail ?? null,
      confidence: params.confidence ?? null,
    },
  });
}
