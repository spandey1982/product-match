import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";

// POST /api/auto-catalog/batches — create a batch and upload images
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 10 * 1024 * 1024;

    const batch = await db.autoCatalogBatch.create({
      data: {
        userId: session.id,
        status: "pending",
        totalCount: files.length,
      },
    });

    // Upload each file to Cloudinary and create items
    const items = await Promise.allSettled(
      files.map(async (file) => {
        if (!allowed.includes(file.type)) {
          throw new Error(`Unsupported type: ${file.type}`);
        }
        if (file.size > maxSize) {
          throw new Error(`File too large: ${file.name}`);
        }

        const bytes = await file.arrayBuffer();
        const b64 = Buffer.from(bytes).toString("base64");
        const dataUri = `data:${file.type};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataUri, {
          folder: "product-match/auto-catalog",
        });

        return db.autoCatalogItem.create({
          data: {
            batchId: batch.id,
            userId: session.id,
            imageUrl: result.secure_url,
            mimeType: file.type,
            fileName: file.name,
            stage: "uploaded",
          },
        });
      })
    );

    const uploaded = items.filter((r) => r.status === "fulfilled").length;
    await db.autoCatalogBatch.update({
      where: { id: batch.id },
      data: { uploadedCount: uploaded },
    });

    return NextResponse.json({ batchId: batch.id, uploaded }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/auto-catalog/batches — list batches for the current user
export async function GET() {
  try {
    const session = await requireAuth();

    const batches = await db.autoCatalogBatch.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ batches });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
