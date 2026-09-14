import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TrialRoomView } from "./TrialRoomView";
import { QuickCaptureTrialRoomView } from "./QuickCaptureTrialRoomView";

export const metadata = { title: "Virtual Trial Room — Mentis" };

export default async function TrialRoomPage() {
  const session = await getSession();
  const profile = session
    ? await db.clientProfile.findUnique({ where: { userId: session.id }, select: { trialRoomLayout: true } })
    : null;

  if (profile?.trialRoomLayout === "quick-capture") {
    return <QuickCaptureTrialRoomView />;
  }

  return <TrialRoomView />;
}
