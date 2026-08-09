"use client";

import { cn } from "@/lib/utils";
import { listImageGenModels, type ImageGenModel } from "@/lib/model-gen/image-gen-models";

interface ImageGenModelChooserProps {
  value: ImageGenModel;
  onChange: (model: ImageGenModel) => void;
}

/** Internal testing knob — swap the Gemini image-gen model per generation. */
export function ImageGenModelChooser({ value, onChange }: ImageGenModelChooserProps) {
  const profiles = listImageGenModels();
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Test model</p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-pressed={active}
              title={m.label}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                active
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
