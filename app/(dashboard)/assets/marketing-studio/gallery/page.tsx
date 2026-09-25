import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Gallery | Marketing Studio" };

const PAGE_SIZE = 24;

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface RenderedOutput {
  aspectRatio: string;
  url: string;
}

function parseOutputs(raw: string): RenderedOutput[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RenderedOutput[]) : [];
  } catch {
    return [];
  }
}

// One tile's worth of data, whichever job type it came from — the whole
// point of this shape is that the grid below never needs to know which.
interface GalleryTile {
  id: string;
  kind: "reel" | "creative";
  status: string;
  createdAt: Date;
  productId: string;
  productTitle: string;
  errorMessage: string | null;
  thumbnailUrl: string | null; // image URL (creative) or video URL (reel) — null only for incomplete jobs
}

export default async function MarketingStudioGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; productId?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { page: pageParam, productId } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  // Scoped when arriving with a product in context (see
  // MarketingStudioNav.tsx — the productId round-trips through here same
  // as any other screen in the section) — matches what a user expects
  // after navigating here from a specific product, without removing the
  // all-products view when no productId is present.
  const where = { userId: session.id, ...(productId ? { productId } : {}) };
  const pageQuery = (p: number) => `?page=${p}${productId ? `&productId=${encodeURIComponent(productId)}` : ""}`;

  // Merging two differently-shaped tables into one chronological feed:
  // Prisma can't UNION across models, so each is queried independently and
  // merged/sorted in JS. Correct interleaved pagination over two sources
  // means fetching enough of EACH to cover every page up to and including
  // this one (not just this page's worth) — re-fetching earlier pages'
  // rows on every request is real, deliberate cost, acceptable at this
  // scale (an internal per-retailer gallery, not a public feed) rather
  // than building real keyset pagination across two tables for marginal
  // benefit. `take` is intentionally the same bound for both sources: the
  // worst case (every item on every prior page came from ONE source) still
  // needs up to `page * PAGE_SIZE` rows from that source to guarantee
  // correctness.
  const fetchLimit = page * PAGE_SIZE;

  const [reelJobs, reelTotal, creativeJobs, creativeTotal] = await Promise.all([
    db.presenterReelJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      include: { product: { select: { id: true, title: true } } },
    }),
    db.presenterReelJob.count({ where }),
    db.marketingCreativeJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      include: { product: { select: { id: true, title: true } } },
    }),
    db.marketingCreativeJob.count({ where }),
  ]);

  const total = reelTotal + creativeTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tiles: GalleryTile[] = [
    ...reelJobs.map((j): GalleryTile => ({
      id: j.id,
      kind: "reel",
      status: j.status,
      createdAt: j.createdAt,
      productId: j.product.id,
      productTitle: j.product.title,
      errorMessage: j.errorMessage,
      thumbnailUrl: j.status === "complete" ? j.videoUrl : null,
    })),
    ...creativeJobs.map((j): GalleryTile => {
      const outputs = parseOutputs(j.outputs);
      const square = outputs.find((o) => o.aspectRatio === "square") ?? outputs[0];
      return {
        id: j.id,
        kind: "creative",
        status: j.status,
        createdAt: j.createdAt,
        productId: j.product.id,
        productTitle: j.product.title,
        errorMessage: j.errorMessage,
        thumbnailUrl: j.status === "complete" ? square?.url ?? null : null,
      };
    }),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function hrefFor(tile: GalleryTile): string {
    const base = tile.kind === "reel" ? "/assets/marketing-studio/presenter-reel" : "/assets/marketing-studio/creative";
    return `${base}?productId=${encodeURIComponent(tile.productId)}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Gallery</h1>
        <p className="text-sm text-gray-500">
          {productId
            ? `Every Presenter Reel and Marketing Creative generated for this product — ${total} total.`
            : `Every Presenter Reel and Marketing Creative you've generated, across all products — ${total} total.`}
        </p>
      </div>

      {tiles.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing here yet — generate a video or creative from a product&apos;s{" "}
          <span className="font-medium text-gray-700">⋮</span> menu to see it appear here.
        </p>
      ) : (
        // Instagram-profile-style tile grid — square thumbnails, no per-
        // card metadata chrome. More columns as the viewport widens, same
        // breakpoints the rest of this section uses.
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2">
          {tiles.map((tile) => (
            <Link
              key={`${tile.kind}-${tile.id}`}
              href={hrefFor(tile)}
              title={tile.productTitle}
              className="group relative block aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gray-100 border border-gray-100"
            >
              {tile.status === "complete" && tile.thumbnailUrl ? (
                tile.kind === "reel" ? (
                  <video src={tile.thumbnailUrl} muted preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tile.thumbnailUrl} alt={tile.productTitle} className="w-full h-full object-cover" />
                )
              ) : tile.status === "failed" ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-red-400 p-2 text-center">
                  <XCircle className="h-5 w-5" />
                  <span className="text-[10px] leading-tight">Failed</span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 p-2 text-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[10px] leading-tight capitalize">{tile.status}</span>
                </div>
              )}

              {tile.kind === "reel" && tile.status === "complete" && (
                <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              )}

              {tile.status === "complete" && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[10px] bg-black/50 rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {formatDate(tile.createdAt)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2 text-sm">
          <Link
            href={`/assets/marketing-studio/gallery${pageQuery(page - 1)}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:text-gray-900"}
          >
            ← Newer
          </Link>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/assets/marketing-studio/gallery${pageQuery(page + 1)}`}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none text-gray-300" : "text-gray-600 hover:text-gray-900"}
          >
            Older →
          </Link>
        </div>
      )}
    </div>
  );
}
