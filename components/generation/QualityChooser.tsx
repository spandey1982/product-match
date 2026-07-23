"use client";

import { cn } from "@/lib/utils";
import { listQualityProfiles, type GenerationQuality } from "@/lib/model-gen/quality";

interface QualityChooserProps {
  value: GenerationQuality;
  onChange: (quality: GenerationQuality) => void;
}

export function QualityChooser({ value, onChange }: QualityChooserProps) {
  const profiles = listQualityProfiles();
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Quality</p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((q) => {
          const active = value === q.id;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onChange(q.id)}
              aria-pressed={active}
              title={q.description}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                active
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">
        {profiles.find((q) => q.id === value)?.description}
      </p>
    </div>
  );
}
