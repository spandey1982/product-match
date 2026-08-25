import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { extractDominantColor } from "@/lib/branding/extract-color";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/** Magic-byte sniff so a renamed non-image can't slip through — mirrors app/api/settings/logo/route.ts. */
function detectMime(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

// POST — admin-scoped variant of app/api/settings/logo/route.ts: uploads on behalf of an
// arbitrary target client, and also returns a deterministic accentColor suggestion.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No logo provided." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "Logo must be a PNG, JPEG or WebP image." }, { status: 400 });
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be under 2 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const actualMime = detectMime(buffer);
    if (!actualMime || !ALLOWED_MIME.has(actualMime)) {
      return NextResponse.json({ error: "File content is not a valid PNG, JPEG or WebP image." }, { status: 400 });
    }

    const publicId = `store-logo-${userId}`;
    const dataUri = `data:${actualMime};base64,${buffer.toString("base64")}`;
    const [uploaded, suggestedAccentColor] = await Promise.all([
      cloudinary.uploader.upload(dataUri, {
        folder: "product-match/logos",
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
      }),
      extractDominantColor(buffer).catch(() => null),
    ]);

    await db.user.update({ where: { id: userId }, data: { logoPublicId: uploaded.public_id } });

    return NextResponse.json({ logoUrl: uploaded.secure_url, suggestedAccentColor });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/clients/logo] upload error:", err);
    return NextResponse.json({ error: "Logo upload failed. Please try again." }, { status: 500 });
  }
}

// DELETE — remove the target client's logo.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await db.user.findUnique({ where: { id: userId }, select: { logoPublicId: true } });
    if (user?.logoPublicId) {
      try {
        await cloudinary.uploader.destroy(user.logoPublicId, { invalidate: true });
      } catch {
        // Best-effort — clear the reference regardless.
      }
    }

    await db.user.update({ where: { id: userId }, data: { logoPublicId: null } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/clients/logo] delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
