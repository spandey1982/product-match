import { NextRequest, NextResponse } from "next/server";
import { requireAuth, verifyPassword, setSession, clearSession } from "@/lib/auth";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

// PATCH — change this retailer's login email. Requires the current password
// (email also gates isAdmin()/ADMIN_EMAILS, so re-confirming identity before
// changing it is a deliberate safety check). Re-issues the session cookie so
// the JWT/Navbar reflect the new email without forcing a re-login.
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const rawEmail = (body as { newEmail?: unknown }).newEmail;
    const currentPassword = (body as { currentPassword?: unknown }).currentPassword;

    if (typeof rawEmail !== "string" || !EMAIL_RE.test(rawEmail.trim())) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "Enter your current password to confirm." }, { status: 400 });
    }

    const newEmail = rawEmail.trim().toLowerCase();

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: "That's already your current email." }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }

    const updated = await db.user.update({
      where: { id: session.id },
      data: { email: newEmail },
    });

    await setSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      storeName: updated.storeName,
      businessType: updated.businessType,
    });

    return NextResponse.json({ email: updated.email });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — request account deletion. Starts the 7-day grace period
// (User.deletedAt) rather than deleting anything immediately; logging back
// in during that window cancels it (see /api/auth/login). Requires the
// literal confirmation text server-side — never trust a client-only
// disabled-button check for something this destructive.
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const confirmation = (body as { confirmation?: unknown }).confirmation;

    if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== "delete") {
      return NextResponse.json({ error: 'Type "delete" to confirm.' }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.id },
      data: { deletedAt: new Date() },
    });

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
