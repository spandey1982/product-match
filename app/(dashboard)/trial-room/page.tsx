"use client";

import { useRouter } from "next/navigation";
import { TrialRoomSetupContent } from "@/components/trial-room/TrialRoomSetupContent";

export default function TrialRoomPage() {
  const router = useRouter();

  return <TrialRoomSetupContent onComplete={() => router.push("/catalog")} />;
}
