"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SignatureModelOption {
  id: string;
  name: string;
}

interface CastingChooserProps {
  signatureModels: SignatureModelOption[];
  value: string;
  onChange: (id: string) => void;
  showManageLink?: boolean;
}

export function CastingChooser({
  signatureModels,
  value,
  onChange,
  showManageLink = true,
}: CastingChooserProps) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Cast the model</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("auto")}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
            value === "auto"
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          )}
        >
          AI Casting
        </button>
        {signatureModels.map((sm) => (
          <button
            key={sm.id}
            type="button"
            onClick={() => onChange(sm.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
              value === sm.id
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}
          >
            {sm.name}
          </button>
        ))}
      </div>
      {showManageLink && (
        <Link
          href="/assets/model-studio"
          className="inline-block text-xs text-indigo-600 hover:text-indigo-800 mt-2"
        >
          Manage in Model Studio →
        </Link>
      )}
    </div>
  );
}
