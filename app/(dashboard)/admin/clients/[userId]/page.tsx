import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";
import { ClientProfileForm } from "./ClientProfileForm";

export const metadata = { title: "Manage Client — Admin" };

function logoUrlFromPublicId(publicId: string): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,h_96/${publicId}`;
}

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const { userId } = await params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, storeName: true, logoPublicId: true },
  });
  if (!user) notFound();

  const profile = await db.clientProfile.findUnique({ where: { userId } });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email} · {user.storeName || "no store name"}</p>
      </div>

      <ClientProfileForm
        userId={user.id}
        initialLogoUrl={user.logoPublicId ? logoUrlFromPublicId(user.logoPublicId) : null}
        allModules={[...ALL_MODULES]}
        initialProfile={
          profile
            ? {
                enabledModules: parseArray(profile.enabledModules) as ModuleKey[],
                primaryModule: profile.primaryModule as ModuleKey,
                brandName: profile.brandName,
                themePreset: profile.themePreset,
                accentColor: profile.accentColor,
              }
            : null
        }
      />
    </div>
  );
}
