import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { purgeDeletedAccounts } from "@/lib/account/purge";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ACCOUNT_PURGE_SECRET;
  if (!secret) return false;

  const provided = req.headers.get("x-purge-secret") ?? "";
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Hard-deletes every User row past its 7-day account-deletion grace period
 * (see User.deletedAt, lib/account/purge.ts). Meant to be triggered by an
 * external scheduler (e.g. a Railway Cron Job) hitting this route on a
 * timer — this repo has no in-process scheduler, so nothing calls this
 * automatically. Secret-gated rather than session-gated since the caller
 * isn't a logged-in user.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeDeletedAccounts();
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
