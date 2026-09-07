import { NextResponse } from "next/server";
import { clearHmUserSession } from "@/lib/home-material/auth";

export async function POST() {
  await clearHmUserSession();
  return NextResponse.json({ ok: true });
}
