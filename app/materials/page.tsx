import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Home Material Intelligence Platform (walls: paint, wallpaper, wall
// texture, wall panels — V1 scope). See docs/home-material/README.md for
// the domain brief and current phase.

export const metadata: Metadata = {
  title: "Home Material Intelligence",
  description:
    "See it. Understand it. Compare it. Buy it. Material decision intelligence for your home, starting with walls.",
};

export default function MaterialsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-5">
        <h1 className="text-2xl font-semibold">Home Material Intelligence</h1>
        <p className="text-muted-foreground">
          Make better material decisions before you spend money on your home.
          Upload a room photo to preview real materials on your wall, or
          browse the material guide first to understand your options.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/materials/upload">
            <Button size="lg">Upload a room photo</Button>
          </Link>
          <Link href="/materials/guide">
            <Button size="lg" variant="secondary">Browse material guide</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
