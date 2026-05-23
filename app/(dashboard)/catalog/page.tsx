import { Suspense } from "react";
import { CatalogView } from "./CatalogView";

export const metadata = {
  title: "Catalog — ProductMatch",
};

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogView />
    </Suspense>
  );
}

function CatalogSkeleton() {
  return (
    <div>
      <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-[3/5]" />
        ))}
      </div>
    </div>
  );
}
