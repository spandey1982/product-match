import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/** Magic-byte sniff so a renamed non-image can't slip through. */
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

// POST — upload (or replace) the store logo.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No logo provided." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPEG or WebP image." },
        { status: 400 }
      );
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be under 2 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const actualMime = detectMime(buffer);
    if (!actualMime || !ALLOWED_MIME.has(actualMime)) {
      return NextResponse.json(
        { error: "File content is not a valid PNG, JPEG or WebP image." },
        { status: 400 }
      );
    }

    // One stable logo per store — overwrite keeps a single asset and lets the
    // branded image URLs (which reference this public_id) update on re-upload.
    const publicId = `store-logo-${session.id}`;
    const dataUri = `data:${actualMime};base64,${buffer.toString("base64")}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "product-match/logos",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    await db.user.update({
      where: { id: session.id },
      data: { logoPublicId: uploaded.public_id },
    });

    return NextResponse.json({ logoUrl: uploaded.secure_url });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[logo] upload error:", err);
    return NextResponse.json({ error: "Logo upload failed. Please try again." }, { status: 500 });
  }
}

// DELETE — remove the store logo (generated images fall back to the store name).
export async function DELETE() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { logoPublicId: true },
    });

    if (user?.logoPublicId) {
      try {
        await cloudinary.uploader.destroy(user.logoPublicId, { invalidate: true });
      } catch {
        // Best-effort — clear the reference regardless.
      }
    }

    await db.user.update({
      where: { id: session.id },
      data: { logoPublicId: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[logo] delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
