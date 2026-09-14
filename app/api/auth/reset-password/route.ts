import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { getLandingPath } from "@/lib/client-modules-server";

// POST /api/auth/reset-password — unauthenticated. Verifies the emailed
// token, sets the new password, and logs the user straight in (matches the
// existing login/signup UX of establishing a session immediately).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token) {
      return NextResponse.json({ error: "Missing or invalid reset link." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const user = await consumePasswordResetToken(token, newPassword);
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    await setSession(user);

    return NextResponse.json({ redirectTo: await getLandingPath(user.id) });
  } catch (err) {
    console.error("[reset-password] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
