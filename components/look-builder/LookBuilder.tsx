"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Sparkles, Check, Loader2 } from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

// ─── API response shapes ──────────────────────────────────────────────────────

interface LookCandidate {
  product: Product;
  matchScore: number;
  explanation: string;
  explanationTags: string[];
}
interface LookSlot {
  id: string;
  label: string;
  required: boolean;
  max: number;
  candidates: LookCandidate[];
}
interface LookResponse {
  hasTemplate: boolean;
  templateLabel: string | null;
  slots: LookSlot[];
}

// ─── Candidate card (compact, horizontal-scroll) ──────────────────────────────

function CandidateCard({ candidate }: { candidate: LookCandidate }) {
  const { product, matchScore } = candidate;
  const { photo, addToQueue, findActiveTryOn, isAtLimit, triggerSetupHint } =
    useTrialRoom();
  const entry = findActiveTryOn(product.id);
  const matchPct = Math.round(matchScore * 100);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!photo) {
      triggerSetupHint();
      return;
    }
    addToQueue(product);
  }

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block w-36 shrink-0"
    >
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
        <div className="relative aspect-[3/4] overflow-hidden">
          <ProductImage
            src={product.imageUrl}
            title={product.title}
            category={product.category}
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-1.5 left-1.5">
            <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-sm text-indigo-600">
              <Sparkles className="h-2.5 w-2.5" />
              <span className="text-[10px] font-bold">{matchPct}%</span>
            </div>
          </div>
        </div>

        <div className="p-2.5">
          <h4 className="text-xs font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {product.title}
          </h4>
          <p className="text-[11px] font-bold text-gray-900 mt-0.5">
            {formatCurrency(product.price)}
          </p>

          {/* Try-on add — reuses the session trial-room flow */}
          {product.imageUrl &&
            (entry?.status === "generating" ? (
              <div className="mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-50 text-indigo-400 text-[11px] font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating
              </div>
            ) : entry?.status === "done" ? (
              <div className="mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-medium">
                <Check className="h-3 w-3" />
                Try-on ready
              </div>
            ) : (
              <button
                onClick={handleAdd}
                disabled={isAtLimit && !entry}
                className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <HangerPlusIcon className="h-3 w-3" />
                {isAtLimit ? "Limit reached" : "Try on"}
              </button>
            ))}
        </div>
      </div>
    </Link>
  );
}

// ─── Slot row ─────────────────────────────────────────────────────────────────

function SlotRow({ slot }: { slot: LookSlot }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-800">{slot.label}</h3>
        {slot.required ? (
          <Badge variant="purple" className="text-[10px]">Essential</Badge>
        ) : (
          <span className="text-[11px] text-gray-400">Optional</span>
        )}
      </div>

      {slot.candidates.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-3 px-3 bg-gray-50 rounded-xl">
          No {slot.label.toLowerCase()} in your catalog yet.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {slot.candidates.map((c) => (
            <CandidateCard key={c.product.id} candidate={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Look Builder ─────────────────────────────────────────────────────────────

export function LookBuilder({ product }: { product: Product }) {
  const [data, setData] = useState<LookResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount loading state
    setLoading(true);
    fetch(`/api/products/${product.id}/look`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LookResponse | null) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-36 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  // No template for this category, or every slot is empty → render nothing so
  // the page is unchanged for products that can't anchor a look.
  if (!data?.hasTemplate) return null;
  const anySlotFilled = data.slots.some((s) => s.candidates.length > 0);
  if (!anySlotFilled) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-900">Complete the Look</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Coordinated pieces to build a full {data.templateLabel?.toLowerCase()} look —
        ranked for this product.
      </p>

      <div className="space-y-5">
        {data.slots.map((slot) => (
          <SlotRow key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  );
}
