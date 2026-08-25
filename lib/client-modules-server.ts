import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";

/** Returns a user's enabled modules — every module when they have no ClientProfile row. */
export async function getEnabledModules(userId: string): Promise<ModuleKey[]> {
  const profile = await db.clientProfile.findUnique({ where: { userId } });
  if (!profile) return [...ALL_MODULES];
  return parseArray(profile.enabledModules) as ModuleKey[];
}

/** Throws "Forbidden" (same string requireAdmin() uses) if the module isn't enabled for this user. */
export async function requireModule(userId: string, module: ModuleKey): Promise<void> {
  const enabled = await getEnabledModules(userId);
  if (!enabled.includes(module)) {
    throw new Error("Forbidden");
  }
}

/** requireAuth() + requireModule() in one call, for API routes gated to a single module. */
export async function requireAuthWithModule(module: ModuleKey): Promise<SessionUser> {
  const session = await requireAuth();
  await requireModule(session.id, module);
  return session;
}
