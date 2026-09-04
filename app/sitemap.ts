import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/rent`, changeFrequency: "daily", priority: 0.8 },
    { url: `${APP_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/signup`, changeFrequency: "yearly", priority: 0.5 },
  ];

  const products = await db.product.findMany({
    where: { isActive: true },
    select: { id: true, updatedAt: true },
  });

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${APP_URL}/shop/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries];
}
