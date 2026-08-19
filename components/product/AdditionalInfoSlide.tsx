import { pairingSuggestions, pairingNote } from "@/lib/product-detail/color-presentation";
import { cn } from "@/lib/utils";

interface AdditionalInfoSlideProps {
  imageUrl: string;
  title: string;
  color: string;
  /**
   * false (default) confines the "Pairs beautifully with" content to the
   * left half, over the gradient's darkest side — the main carousel slide.
   * true lets it span the full width instead — the rail thumbnail preview,
   * which needs all the room it can get once the whole slide is scaled down
   * to fit a ~60px button.
   */
  fullWidthContent?: boolean;
}

/**
 * The /shop PDP's 3rd carousel slot (after front, back) — a slightly-zoomed
 * crop of the front image with a left-to-right black gradient (80%→20%
 * opacity, so the image stays visible through the lighter right edge too)
 * and the "Pairs beautifully with" content on top, vertically centered.
 * pairingSuggestions/pairingNote are the same presentation-only helpers the
 * retailer PDP's "Pairs beautifully with" card already uses — not the
 * protected color-harmony scoring engine.
 */
export function AdditionalInfoSlide({ imageUrl, title, color, fullWidthContent = false }: AdditionalInfoSlideProps) {
  const suggestions = pairingSuggestions(color);
  const note = pairingNote(color);

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`${title} — detail`} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/20" />

      <div
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col justify-center px-5 sm:px-6",
          fullWidthContent ? "w-full" : "w-1/2"
        )}
      >
        <h3 className="text-white font-heading text-lg sm:text-xl font-medium mb-3 leading-tight">
          Pairs beautifully with
        </h3>
        <div className="flex flex-col gap-2.5">
          {suggestions.map((c) => (
            <div key={c.name} className="flex items-center gap-2.5">
              <span
                className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/30 border-2 border-white/80 shadow-sm"
                style={{ backgroundColor: c.hex }}
              />
              <span className="text-xs text-white/90 leading-tight truncate">{c.name}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/70 leading-relaxed mt-3">{note}</p>
      </div>
    </div>
  );
}
