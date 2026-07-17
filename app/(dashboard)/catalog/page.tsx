import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CatalogView } from "./CatalogView";

export const metadata = {
  title: "Catalog — Mentis",
};

/**
 * Build a lightweight delivery URL for the retailer's uploaded logo.
 * Height-capped + f_auto,q_auto so the header request stays tiny.
 */
function logoUrlFromPublicId(publicId: string): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,h_96/${publicId}`;
}

export default async function CatalogPage() {
  // Layout already guarantees a session; this call is here to fetch the
  // logo public_id (JWT doesn't carry it) and to keep types honest.
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { logoPublicId: true },
  });

  const logoUrl = user?.logoPublicId ? logoUrlFromPublicId(user.logoPublicId) : null;

  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogView storeName={session.storeName ?? null} logoUrl={logoUrl} />
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
