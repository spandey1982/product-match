import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const VALID_STATUSES = ["open", "done", "dismissed"];

interface Props {
  params: Promise<{ id: string }>;
}

/** Status-only update for a /admin/tasks row — see prisma/schema.prisma's TaskItem doc comment. */
export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status } = (await req.json()) as { status?: string };

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const existing = await db.taskItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updated = await db.taskItem.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, task: updated });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
