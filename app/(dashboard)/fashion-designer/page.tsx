import type { Metadata } from "next";
import { DesignLibrary } from "./DesignLibrary";

export const metadata: Metadata = { title: "AI Fashion Designer | Mentis" };

export default function FashionDesignerPage() {
  return <DesignLibrary />;
}
