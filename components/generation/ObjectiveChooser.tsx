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
  const selected = objectives.find((o) => o.id === value);
  const selectedMeta = selected ? OBJECTIVE_META[selected.id] : undefined;
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-50 rounded-2xl">
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
                "rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                active ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {meta?.label ?? o.label}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="text-xs text-gray-400 mt-2">{selectedMeta?.desc ?? selected.description}</p>
      )}
    </div>
  );
}
