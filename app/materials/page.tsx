import type { Metadata } from "next";

// Placeholder for the Home Material Intelligence Platform (walls: paint,
// wallpaper, wall texture, wall panels — V1 scope). No feature logic yet —
// see docs/home-material/README.md for the domain brief and current phase.

export const metadata: Metadata = {
  title: "Home Material Intelligence — Coming Soon",
  description:
    "See it. Understand it. Compare it. Buy it. Material decision intelligence for your home, starting with walls.",
};

export default function MaterialsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Home Material Intelligence</h1>
        <p className="text-muted-foreground">
          Make better material decisions before you spend money on your home.
          This product is in foundation — coming soon.
        </p>
      </div>
    </main>
  );
}
