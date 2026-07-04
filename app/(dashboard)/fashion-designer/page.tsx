import type { Metadata } from "next";
import { DesignLibrary } from "./DesignLibrary";

export const metadata: Metadata = { title: "Design Studio | Mentis" };

export default function FashionDesignerPage() {
  return <DesignLibrary />;
}
