import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// GET /api/fashion-designer/models
// Diagnostic: list Gemini models that support image generation
export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`
    );
    const data = await res.json() as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[]; displayName?: string }>;
    };

    const all = data.models ?? [];
    // Filter to anything that might support image output
    const imageCapable = all.filter((m) =>
      m.name.toLowerCase().includes("imagen") ||
      m.name.toLowerCase().includes("image") ||
      m.supportedGenerationMethods?.includes("predict")
    );

    return NextResponse.json({
      imageCapable,
      all: all.map((m) => ({ name: m.name, methods: m.supportedGenerationMethods })),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
