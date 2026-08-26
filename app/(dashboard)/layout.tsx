import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { TrialRoomProvider } from "@/components/trial-room/TrialRoomProvider";
import { GenerationStatusProvider } from "@/components/generation/GenerationStatusProvider";
import { ClientModulesProvider } from "@/components/layout/ClientModulesProvider";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";
import { parseArray } from "@/lib/serialize";
import { resolveBrandTheme, brandThemeCssVars } from "@/lib/branding/presets";

/** Height-capped + f_auto,q_auto so the header request stays tiny — mirrors catalog/page.tsx's logoUrlFromPublicId. */
function logoUrlFromPublicId(publicId: string): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,h_96/${publicId}`;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [user, clientProfile] = await Promise.all([
    db.user.findUnique({ where: { id: session.id }, select: { logoPublicId: true } }),
    db.clientProfile.findUnique({ where: { userId: session.id } }),
  ]);

  const enabledModules: ModuleKey[] = clientProfile
    ? (parseArray(clientProfile.enabledModules) as ModuleKey[])
    : [...ALL_MODULES];
  const primaryModule = (clientProfile?.primaryModule ?? "catalog") as ModuleKey;
  const theme = resolveBrandTheme(clientProfile);
  const logoUrl = user?.logoPublicId ? logoUrlFromPublicId(user.logoPublicId) : null;

  return (
    <GenerationStatusProvider>
      <TrialRoomProvider storageKey={`trial-room-v1-${session.id}`}>
        <ClientModulesProvider modules={enabledModules}>
          <div
            className="min-h-screen bg-[#fafafa]"
            style={brandThemeCssVars(theme) as React.CSSProperties}
          >
            <Navbar
              user={{
                name: session.name,
                email: session.email,
                storeName: session.storeName,
                businessType: session.businessType,
              }}
              isAdmin={isAdmin(session)}
              enabledModules={enabledModules}
              primaryModule={primaryModule}
              brandName={theme.brandName}
              logoUrl={logoUrl}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
          </div>
        </ClientModulesProvider>
      </TrialRoomProvider>
    </GenerationStatusProvider>
  );
}
