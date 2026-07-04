import type { Metadata } from "next";
import { NewDesignView } from "./NewDesignView";

export const metadata: Metadata = { title: "New Design | Design Studio | Mentis" };

export default function NewDesignPage() {
  return <NewDesignView />;
}
