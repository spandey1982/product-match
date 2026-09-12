import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getOrCreateHmUserSession();

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({
    where: { id: roomId },
    include: { surfaces: true, project: true },
  });

  if (!room || room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}

/**
 * Replace this room's photo in place ("reupload"). Existing HmSurface rows
 * are tied to the OLD photo's geometry — a wall polygon drawn against one
 * image is meaningless against a different one — so they're deleted here
 * (cascades to any HmVisualization on them too), not left stale.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getOrCreateHmUserSession();

  const { roomId } = await params;
  const room = await db.hmRoom.findUnique({ where: { id: roomId }, include: { project: true } });
  if (!room || room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File size must be under 5MB" }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;
    const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/rooms" });

    const [updatedRoom] = await db.$transaction([
      db.hmRoom.update({ where: { id: roomId }, data: { imageUrl: result.secure_url } }),
      db.hmSurface.deleteMany({ where: { roomId } }),
    ]);

    return NextResponse.json({ room: { ...updatedRoom, surfaces: [] } });
  } catch (err) {
    console.error("Home Material room reupload error:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
