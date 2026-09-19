import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isAdmin, HM_CATALOGUE_MANAGER_ROLE } from "@/lib/auth";

/**
 * Grants/revokes the HM_CATALOGUE_MANAGER role — deliberately ADMIN-only
 * (not canManageHmCatalogue), so a catalogue manager can never grant
 * themselves or anyone else broader access. Reuses the existing User.role
 * field rather than a new table (see lib/auth.ts's doc comment) — searches
 * by email since there's no self-serve account creation for this role;
 * the account owner creates or repurposes a real login first, then grants
 * this from here.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      ...(q ? { email: { contains: q, mode: "insensitive" } } : { role: { in: ["ADMIN", HM_CATALOGUE_MANAGER_ROLE] } }),
    },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
    take: 25,
  });

  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId;
  const grant = body?.grant;
  if (typeof userId !== "string" || typeof grant !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "This user is already a full admin" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { role: grant ? HM_CATALOGUE_MANAGER_ROLE : "RETAILER" },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
