"use client";

import { useState } from "react";
import { Product } from "@/types";
import {
  buildCaption,
  shareModelImage,
  downloadImage,
  copyText,
  openInstagram,
} from "@/lib/share-image";
import { masterUrl } from "@/lib/images/variants";
import { cn } from "@/lib/utils";
import {
  Share2,
  Download,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Props {
  product: Product;
  iconOnly?: boolean;
}

type ShareState = "idle" | "loading" | "success" | "fallback";

// ─── Instagram gradient helpers ───────────────────────────────────────────────
const igGradient =
  "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]";

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareModelImage({ product, iconOnly = false }: Props) {
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const caption = buildCaption(product);
  // Share/download previously used the bare stored URL directly — the one path
  // in the app that bypassed the delivery-variant system entirely, transferring
  // the full unoptimized master on every share/download.
  const imageUrl = masterUrl(product.modelImageUrl!);
  const downloadFilename = `${(product.title ?? "product")
    .replace(/\s+/g, "-")
    .toLowerCase()}-model.jpg`;

  // ── Share handler ────────────────────────────────────────────────────────
  async function handleShare() {
    setShareState("loading");
    setActionError(null);

    const result = await shareModelImage(imageUrl, caption, product.title);

    if (result === "shared") {
      setShareState("success");
      setTimeout(() => setShareState("idle"), 3000);
    } else if (result === "cancelled") {
      // User dismissed the native sheet — just return to idle quietly
      setShareState("idle");
    } else {
      // "unsupported" — show manual fallback panel
      setShareState("fallback");
    }
  }

  // ── Fallback: download ───────────────────────────────────────────────────
  async function handleDownload() {
    setActionError(null);
    try {
      await downloadImage(imageUrl, downloadFilename);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      setActionError("Download failed — try again");
    }
  }

  // ── Fallback: copy caption ───────────────────────────────────────────────
  async function handleCopy() {
    setActionError(null);
    try {
      await copyText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setActionError("Could not access clipboard");
    }
  }

  // ── Icon-only overlay button ──────────────────────────────────────────────
  if (iconOnly) {
    return (
      <button
        onClick={handleShare}
        disabled={shareState === "loading"}
        aria-label="Share"
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200",
          "bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 active:scale-95",
          shareState === "success" && "bg-green-500/80 hover:bg-green-500/80",
          shareState === "loading" && "opacity-75 pointer-events-none",
        )}
      >
        {shareState === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : shareState === "success" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">

      {/* ── Primary share button (idle / loading / success) ── */}
      {shareState !== "fallback" && (
        <button
          onClick={handleShare}
          disabled={shareState === "loading" || shareState === "success"}
          aria-label="Share on Instagram"
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 select-none border",
            shareState === "success"
              ? "bg-green-50 text-green-700 border-green-200 cursor-default"
              : [
                  "bg-white text-gray-600 border-gray-200",
                  "hover:bg-gray-50 active:scale-[0.98]",
                  shareState === "loading" && "opacity-75 pointer-events-none",
                ]
          )}
        >
          {shareState === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing…
            </>
          ) : shareState === "success" ? (
            <>
              <Check className="h-4 w-4" />
              Shared!
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              Share
            </>
          )}
        </button>
      )}

      {/* ── Fallback panel ── */}
      {shareState === "fallback" && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 backdrop-blur-sm p-4 space-y-3.5">
          {/* Instruction */}
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
            <span>
              Native sharing isn't available on this device. Save the image,
              copy the caption, then post on Instagram.
            </span>
          </div>

          {/* 3 action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {/* Download */}
            <FallbackButton
              icon={downloaded ? Check : Download}
              label={downloaded ? "Saved!" : "Download"}
              onClick={handleDownload}
              active={downloaded}
            />

            {/* Copy caption */}
            <FallbackButton
              icon={copied ? Check : Copy}
              label={copied ? "Copied!" : "Copy Caption"}
              onClick={handleCopy}
              active={copied}
            />

            {/* Open Instagram */}
            <button
              onClick={openInstagram}
              aria-label="Open Instagram"
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95",
                igGradient,
                "text-white shadow-sm"
              )}
            >
              <ExternalLink className="h-4 w-4" />
              Instagram
            </button>
          </div>

          {/* Caption preview (collapsible feel — always visible but compact) */}
          <div className="rounded-xl bg-white border border-gray-100 p-3">
            <p className="text-[10px] font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              Caption preview
            </p>
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-5 whitespace-pre-line">
              {caption}
            </p>
          </div>

          {/* Reset */}
          <button
            onClick={() => setShareState("idle")}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
          >
            ← Try native share again
          </button>
        </div>
      )}

      {/* ── Error message ── */}
      {actionError && (
        <p className="text-xs text-red-500 flex items-center gap-1 px-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {actionError}
        </p>
      )}
    </div>
  );
}

// ─── Small helper: fallback action button ─────────────────────────────────────

function FallbackButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all border active:scale-95",
        active
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-white border-gray-100 text-gray-700 hover:border-gray-200 hover:bg-gray-50"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
