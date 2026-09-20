/**
 * Seeds PresenterPersona rows from the PERSONA_LIBRARY registry
 * (lib/presenter-reel/personas.ts) — upserts on faceRegistryId so
 * re-running is safe. Same pattern as scripts/seed-task-backlog.ts.
 *
 * Usage: npx tsx scripts/seed-presenter-personas.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { PERSONA_LIBRARY } from "../lib/presenter-reel/personas";

async function main() {
  for (const persona of PERSONA_LIBRARY) {
    const existing = await db.presenterPersona.findFirst({ where: { faceRegistryId: persona.faceRegistryId } });
    if (existing) {
      await db.presenterPersona.update({
        where: { id: existing.id },
        data: { name: persona.name, voiceProviderId: persona.voiceProviderId, language: persona.language },
      });
      console.log("Updated:", persona.name);
    } else {
      await db.presenterPersona.create({
        data: {
          name: persona.name,
          faceRegistryId: persona.faceRegistryId,
          voiceProviderId: persona.voiceProviderId,
          language: persona.language,
        },
      });
      console.log("Created:", persona.name);
    }
  }
}

main().finally(() => db.$disconnect());
