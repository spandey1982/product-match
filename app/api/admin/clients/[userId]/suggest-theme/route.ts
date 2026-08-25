import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestThemePreset } from "@/lib/branding/suggest-preset";

/**
 * Admin-triggered, explicit-click-only theme suggestion. Real paid Gemini
 * call — no chargeForCall (internal ops call, not billed to the retailer's
 * wallet), mirroring app/api/admin/garment-intelligence/route.ts. Usage is
 * still recorded (inside suggestThemePreset -> callGeminiForJson) against
 * the target client's userId so it shows up in /admin/usage.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { logoPublicId: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const imageUrls: string[] = [];
    if (user.logoPublicId && cloud) {
      imageUrls.push(`https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${user.logoPublicId}`);
    }

    const products = await db.product.findMany({
      where: { userId, isActive: true },
      select: { imageUrl: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    for (const p of products) {
      if (p.imageUrl) imageUrls.push(p.imageUrl);
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "This client has no logo or product photos yet to analyze." },
        { status: 400 }
      );
    }

    const suggestion = await suggestThemePreset(imageUrls, { userId });
    return NextResponse.json(suggestion);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/clients/suggest-theme] error:", err);
    return NextResponse.json({ error: "Theme suggestion failed. Please try again." }, { status: 500 });
  }
}
