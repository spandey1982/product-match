import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";

// POST /api/fashion-designer/designs — create a design session + upload assets
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const formData = await req.formData();

    const title = String(formData.get("title") || "Untitled Design");
    const garmentType = String(formData.get("garmentType") || "");

    // Collect all uploaded files with their asset type
    // Field name format: "fabric", "sketch", "reference", "accessory", "neck",
    // "sleeve", "back", "border", "color_palette", "other"
    const assetTypes = [
      "fabric", "sketch", "reference", "accessory",
      "neck", "sleeve", "back", "border", "color_palette", "other",
    ];

    type FileEntry = { file: File; assetType: string };
    const fileEntries: FileEntry[] = [];

    for (const assetType of assetTypes) {
      const files = formData.getAll(assetType) as File[];
      for (const file of files) {
        if (file instanceof File) fileEntries.push({ file, assetType });
      }
    }

    const fabricFiles = fileEntries.filter((e) => e.assetType === "fabric");
    if (fabricFiles.length === 0) {
      return NextResponse.json({ error: "At least one fabric image is required" }, { status: 400 });
    }

    const design = await db.fashionDesign.create({
      data: { userId: session.id, title, garmentType, stage: "uploading" },
    });

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 10 * 1024 * 1024;

    const uploadResults = await Promise.allSettled(
      fileEntries.map(async ({ file, assetType }) => {
        if (!allowed.includes(file.type)) throw new Error(`Unsupported type: ${file.type}`);
        if (file.size > maxSize) throw new Error(`File too large: ${file.name}`);

        const bytes = await file.arrayBuffer();
        const b64 = Buffer.from(bytes).toString("base64");
        const dataUri = `data:${file.type};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataUri, {
          folder: "product-match/fashion-designer/assets",
        });

        return db.fashionDesignAsset.create({
          data: {
            designId: design.id,
            assetType,
            url: result.secure_url,
            fileName: file.name,
            mimeType: file.type,
          },
        });
      })
    );

    const uploaded = uploadResults.filter((r) => r.status === "fulfilled").length;
    if (uploaded === 0) {
      await db.fashionDesign.delete({ where: { id: design.id } });
      return NextResponse.json({ error: "All asset uploads failed" }, { status: 500 });
    }

    return NextResponse.json({ designId: design.id, uploaded }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/fashion-designer/designs — list designs for current user
export async function GET() {
  try {
    const session = await requireAuth();
    const designs = await db.fashionDesign.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ designs });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
