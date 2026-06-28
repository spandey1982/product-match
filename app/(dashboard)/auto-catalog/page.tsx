import { Metadata } from "next";
import { AutoCatalogView } from "./AutoCatalogView";

export const metadata: Metadata = { title: "Autonomous Catalog — Mentis" };

export default function AutoCatalogPage() {
  return <AutoCatalogView />;
}
