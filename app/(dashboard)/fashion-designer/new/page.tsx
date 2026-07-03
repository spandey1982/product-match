import type { Metadata } from "next";
import { NewDesignView } from "./NewDesignView";

export const metadata: Metadata = { title: "New Design | Fabric Flow | Mentis" };

export default function NewDesignPage() {
  return <NewDesignView />;
}
