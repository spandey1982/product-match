"use client";

import { cn } from "@/lib/utils";

const OBJECTIVE_META: Record<string, { label: string; desc: string }> = {
  quick_listing: { label: "Quick Listing", desc: "One fast on-model front shot." },
  catalogue: { label: "Catalogue & Social", desc: "Full multi-view set for catalog & social." },
};

export interface ObjectiveOption {
  id: string;
  label: string;
  description: string;
}

interface ObjectiveChooserProps {
  objectives: ObjectiveOption[];
  value: string;
  onChange: (id: string) => void;
}

export function ObjectiveChooser({ objectives, value, onChange }: ObjectiveChooserProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {objectives.map((o) => {
        const active = value === o.id;
        const meta = OBJECTIVE_META[o.id];
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              "text-left rounded-2xl border p-3 transition-all",
              active
                ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 ring-1 ring-purple-200"
                : "border-gray-100 bg-white hover:border-gray-200"
            )}
          >
            <span className="text-sm font-semibold text-gray-900">{meta?.label ?? o.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
              {meta?.desc ?? o.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
