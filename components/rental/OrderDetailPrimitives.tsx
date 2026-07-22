/** Small presentational rows shared by the customer receipt and the retailer admin order view. */

export function Fact({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className ?? ""}`}>
      <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-gray-400 tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
