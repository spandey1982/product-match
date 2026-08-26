import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeArray } from "@/lib/serialize";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";
import { isThemePresetKey } from "@/lib/branding/presets";

// PUT /api/admin/clients/[userId] — create or update the target account's ClientProfile.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const enabledModulesRaw = Array.isArray(body.enabledModules) ? body.enabledModules : [];
    const enabledModules = enabledModulesRaw.filter((m: unknown): m is ModuleKey =>
      typeof m === "string" && (ALL_MODULES as readonly string[]).includes(m)
    );

    const primaryModule = typeof body.primaryModule === "string" ? body.primaryModule : "catalog";
    const brandName = typeof body.brandName === "string" && body.brandName.trim() ? body.brandName.trim() : null;
    const themePreset = typeof body.themePreset === "string" && isThemePresetKey(body.themePreset)
      ? body.themePreset
      : "default";
    const accentColor = typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)
      ? body.accentColor
      : null;

    const profile = await db.clientProfile.upsert({
      where: { userId },
      create: {
        userId,
        enabledModules: serializeArray(enabledModules),
        primaryModule,
        brandName,
        themePreset,
        accentColor,
      },
      update: {
        enabledModules: serializeArray(enabledModules),
        primaryModule,
        brandName,
        themePreset,
        accentColor,
      },
    });

    return NextResponse.json({ profile });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/clients] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/clients/[userId] — remove the ClientProfile row, reverting the account to the unrestricted default.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    await db.clientProfile.deleteMany({ where: { userId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/clients] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
