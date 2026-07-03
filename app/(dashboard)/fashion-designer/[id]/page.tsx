import type { Metadata } from "next";
import { DesignView } from "./DesignView";

export const metadata: Metadata = { title: "Design | Fabric Flow | Mentis" };

export default function DesignDetailPage() {
  return <DesignView />;
}
