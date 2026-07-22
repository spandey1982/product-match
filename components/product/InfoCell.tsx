import { cn } from "@/lib/utils";

// ─── Product Information card — icon/swatch + label + value cell ────────────
// Extracted from ProductDetailView so the public rental detail view can reuse
// the same fact-grid layout instead of duplicating it.

export function InfoCell({
  icon: Icon,
  swatch,
  image,
  label,
  children,
}: {
  icon?: React.ElementType;
  swatch?: string;
  image?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 sm:p-3 min-w-0">
      <div className="h-8 w-8 rounded-xl shrink-0 overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : swatch ? (
          <span className="h-full w-full block" style={{ backgroundColor: swatch }} />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5 tracking-wide font-body">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function FieldValue({ value, descriptor }: { value: string; descriptor?: string | null }) {
  return (
    <>
      <p className="text-sm font-semibold text-gray-900 truncate font-body">{value}</p>
      {descriptor && <p className="text-xs text-gray-400 mt-0.5 truncate font-body">{descriptor}</p>}
    </>
  );
}

export function FieldRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 divide-x divide-gray-100", !last && "border-b border-gray-100")}>
      {children}
    </div>
  );
}
