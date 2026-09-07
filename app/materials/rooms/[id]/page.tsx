import { RoomView } from "./RoomView";

export const metadata = { title: "Room — Home Material Intelligence" };

export default async function MaterialsRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoomView roomId={id} />;
}
