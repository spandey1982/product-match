"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

const CATEGORY_GRADIENTS: Record<string, string> = {
  saree: "from-rose-100 to-pink-200",
  lehenga: "from-purple-100 to-violet-200",
  blouse: "from-pink-100 to-rose-200",
  dupatta: "from-teal-100 to-cyan-200",
  kurta: "from-orange-100 to-amber-200",
  salwar: "from-yellow-100 to-amber-200",
  anarkali: "from-violet-100 to-purple-200",
  sharara: "from-fuchsia-100 to-pink-200",
  palazzo: "from-sky-100 to-blue-200",
  jewellery: "from-amber-100 to-yellow-200",
  footwear: "from-stone-100 to-neutral-200",
  clutch: "from-emerald-100 to-green-200",
  handbag: "from-lime-100 to-green-200",
  suit: "from-slate-100 to-gray-200",
  tie: "from-indigo-100 to-blue-200",
  default: "from-indigo-50 to-purple-100",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  saree: "🥻",
  lehenga: "👗",
  blouse: "👚",
  dupatta: "🧣",
  kurta: "👘",
  salwar: "👖",
  anarkali: "👗",
  sharara: "👗",
  palazzo: "👖",
  jewellery: "💎",
  footwear: "👡",
  clutch: "👛",
  handbag: "👜",
  suit: "🤵",
  tie: "👔",
  default: "🛍️",
};

interface ProductImageProps {
  src?: string | null;
  title: string;
  category: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function ProductImage({
  src,
  title,
  category,
  className,
}: ProductImageProps) {
  const [error, setError] = useState(false);
  const normalized = category.toLowerCase().replace(/\s+/g, "");
  const gradient = CATEGORY_GRADIENTS[normalized] || CATEGORY_GRADIENTS.default;
  const emoji = CATEGORY_EMOJIS[normalized] || CATEGORY_EMOJIS.default;

  if (!src || error) {
    return (
      <div
        className={cn(
          `bg-gradient-to-br ${gradient} flex flex-col items-center justify-center`,
          className
        )}
      >
        <span className="text-5xl mb-2 select-none">{emoji}</span>
        <span className="text-xs font-medium text-gray-500 text-center px-2 capitalize">
          {category}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      className={cn("object-contain", className)}
      onError={() => setError(true)}
    />
  );
}
