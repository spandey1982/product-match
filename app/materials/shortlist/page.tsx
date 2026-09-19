import { ShortlistView } from "./ShortlistView";

// Per-user saved list — same noindex reasoning as app/shop/wishlist/page.tsx.
export const metadata = { title: "Compare — Home Material Intelligence", robots: { index: false, follow: false } };

export default function MaterialsShortlistPage() {
  return <ShortlistView />;
}
