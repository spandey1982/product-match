import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

export default async function MarketingStudioGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [jobs, total] = await Promise.all([
    db.presenterReelJob.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { id: true, title: true } },
        persona: { select: { name: true } },
      },
    }),
    db.presenterReelJob.count({ where: { userId: session.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Gallery</h1>
        <p className="text-sm text-gray-500">
          Every Presenter Reel you&apos;ve generated, across all products — {total} total.
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing here yet — generate a video from a product&apos;s{" "}
          <span className="font-medium text-gray-700">⋮ → Create Marketing Video</span> to see it appear here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <Link
                  href={`/assets/marketing-studio/presenter-reel?productId=${job.product.id}`}
                  className="font-medium text-gray-700 hover:underline truncate max-w-[65%]"
                >
                  {job.product.title}
                </Link>
                {job.status === "complete" ? (
                  <span className="flex items-center gap-1 text-emerald-600 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </span>
                ) : job.status === "failed" ? (
                  <span className="flex items-center gap-1 text-red-500 shrink-0">
                    <XCircle className="h-3.5 w-3.5" /> Failed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 shrink-0">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {job.status}
                  </span>
                )}
              </div>

              {job.status === "complete" && job.videoUrl ? (
                <video src={job.videoUrl} controls preload="metadata" className="w-full rounded-xl border border-gray-100" />
              ) : job.status === "failed" ? (
                <p className="text-xs text-red-500">
                  {job.errorMessage === "insufficient_credits" ? "Not enough credits at the time." : job.errorMessage ?? "Something went wrong."}
                </p>
              ) : (
                <div className="w-full aspect-[9/16] max-h-40 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                  Still {job.status}…
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>{job.persona.name}</span>
                <span>{formatDate(job.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2 text-sm">
          <Link
            href={`/assets/marketing-studio/gallery?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:text-gray-900"}
          >
            ← Newer
          </Link>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/assets/marketing-studio/gallery?page=${page + 1}`}
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
