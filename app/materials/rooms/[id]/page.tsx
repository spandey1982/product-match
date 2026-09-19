import { RoomView } from "./RoomView";

// Private per-user room workspace (real uploaded room photos) — same
// double-protection (robots.ts disallow + page-level noindex) as
// app/deliver/[id]/page.tsx.
export const metadata = { title: "Room — Home Material Intelligence", robots: { index: false, follow: false } };

export default async function MaterialsRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoomView roomId={id} />;
}
