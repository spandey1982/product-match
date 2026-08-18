import { pairingSuggestions, pairingNote } from "@/lib/product-detail/color-presentation";

interface AdditionalInfoSlideProps {
  imageUrl: string;
  title: string;
  color: string;
}

/**
 * The /shop PDP's 3rd carousel slot (after front, back) — a slightly-zoomed
 * crop of the front image with a left-to-right black-to-transparent gradient
 * (80%→0% opacity) and the "Pairs beautifully with" content left-aligned on
 * top. pairingSuggestions/pairingNote are the same presentation-only helpers
 * the retailer PDP's "Pairs beautifully with" card already uses — not the
 * protected color-harmony scoring engine.
 */
export function AdditionalInfoSlide({ imageUrl, title, color }: AdditionalInfoSlideProps) {
  const suggestions = pairingSuggestions(color);
  const note = pairingNote(color);

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`${title} — detail`} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-6 max-w-[75%] sm:max-w-[65%]">
        <p className="text-white/70 text-[10px] font-medium tracking-wide uppercase mb-2">Additional Info</p>
        <h3 className="text-white font-heading text-lg sm:text-xl font-medium mb-3 leading-tight">
          Pairs beautifully with
        </h3>
        <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-1">
          {suggestions.map((c) => (
            <div key={c.name} className="flex flex-col items-center gap-1.5 shrink-0">
              <span
                className="h-7 w-7 rounded-full ring-1 ring-white/30 border-2 border-white/80 shadow-sm"
                style={{ backgroundColor: c.hex }}
              />
              <span className="text-[11px] text-white/90 text-center leading-tight whitespace-nowrap">
                {c.name}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/70 leading-relaxed mt-3 max-w-xs">{note}</p>
      </div>
    </div>
  );
}
