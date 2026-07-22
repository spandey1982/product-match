import { PublicHeader } from "@/components/layout/PublicHeader";

/**
 * Public layout for the /rent marketplace — no auth check. Distinct from
 * app/(dashboard)/layout.tsx, which redirects anonymous visitors to /login.
 */
export default function RentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <PublicHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
