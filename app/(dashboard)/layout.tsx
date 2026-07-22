import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { TrialRoomProvider } from "@/components/trial-room/TrialRoomProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <TrialRoomProvider>
      <div className="min-h-screen bg-[#fafafa]">
        <Navbar
          user={{
            name: session.name,
            email: session.email,
            storeName: session.storeName,
            businessType: session.businessType,
          }}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </div>
    </TrialRoomProvider>
  );
}
