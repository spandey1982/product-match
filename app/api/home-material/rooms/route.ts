import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { uploadWithRetry, isCloudinaryConnectivityError } from "@/lib/cloudinary";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB, matches the app-wide upload cap

/** V1 has no project-management UI yet — every HmUser gets a single implicit "My Home" project, created on first room upload. */
async function getOrCreateDefaultProject(hmUserId: string) {
  const existing = await db.hmProject.findFirst({ where: { hmUserId } });
  if (existing) return existing;
  return db.hmProject.create({ data: { hmUserId } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getHmUserSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const roomType = (formData.get("roomType") as string | null) || "unspecified";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size must be under 5MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;

    const result = await uploadWithRetry(dataUri, { folder: "product-match/home-material/rooms" });

    const project = await getOrCreateDefaultProject(session.id);
    const room = await db.hmRoom.create({
      data: {
        projectId: project.id,
        roomType,
        imageUrl: result.secure_url,
      },
    });

    return NextResponse.json({ room });
  } catch (err) {
    console.error("Home Material room upload error:", err);
    if (isCloudinaryConnectivityError(err)) {
      return NextResponse.json(
        { error: "Image storage is temporarily unreachable — nothing was saved. Please try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await db.hmRoom.findMany({
    where: { project: { hmUserId: session.id } },
    orderBy: { createdAt: "desc" },
    include: { surfaces: true },
  });

  return NextResponse.json({ rooms });
}
