import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

export async function GET() {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hmUser = await db.hmUser.findUnique({
    where: { id: session.id },
    select: { id: true, phone: true, name: true, email: true },
  });

  if (!hmUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ hmUser });
}
