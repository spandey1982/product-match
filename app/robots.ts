import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";

// Public surface: homepage, auth entry points, /shop and /rent storefronts.
// Excluded: customer-account sub-routes (wishlist/orders/try-ons/addresses),
// /shop/collections (staff tool — see its own page-level noindex too),
// /deliver/[id] (unguessable-id access control, must never be crawled),
// /api/*, and the entire authenticated (dashboard) retailer app.
const DISALLOW = [
  "/api/",
  "/shop/collections",
  "/shop/wishlist",
  "/shop/orders",
  "/shop/my-try-ons",
  "/rent/account",
  "/rent/addresses",
  "/rent/orders",
  "/rent/my-try-ons",
  "/deliver/",
  "/admin",
  "/catalog",
  "/products",
  "/upload",
  "/billing",
  "/settings",
  "/trial-room",
  "/assets",
  "/fashion-designer",
  "/auto-catalog",
  "/wishlist",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Applies to classic search crawlers and every major AI/generative
        // engine crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
        // CCBot) — leaving these unblocked is what makes GEO/AEO possible.
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
