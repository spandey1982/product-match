import type { Metadata } from "next";
import { DesignLibrary } from "./DesignLibrary";

export const metadata: Metadata = { title: "Fabric Flow | Mentis" };

export default function FashionDesignerPage() {
  return <DesignLibrary />;
}
