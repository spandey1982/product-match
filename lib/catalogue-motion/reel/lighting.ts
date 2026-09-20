/**
 * Per-material lighting language for reel prompts.
 *
 * Researched but never implemented until now (see
 * research/reel-engine-components.html's "Lighting and shadow" section):
 * professional fashion-video sources describe lighting choice as deliberate
 * and matched to the specific material in frame, not applied uniformly —
 * diffused light to control sheen on silk, raking side-light for texture on
 * heavier weaves, backlight for sheers, soft frontal fill to avoid crushing
 * velvet into pure black. Every reel prompt before this change carried zero
 * lighting instruction at all beyond "keep it fixed" — Veo was never told
 * what the lighting should actually look like, only that it shouldn't
 * change from whatever the flat catalogue-studio source photo already has.
 *
 * This can't fix the deeper structural ceiling (Veo animates the source
 * photo's existing lighting, it cannot relight the scene) — it can only
 * describe how that existing light should read, which is still a real,
 * previously-unused lever.
 */

const MATERIAL_LIGHTING: Array<{ match: RegExp; descriptor: string }> = [
  {
    match: /silk|satin|shimmer/i,
    descriptor: "soft, diffused lighting that controls the fabric's natural sheen without flattening it",
  },
  {
    match: /chiffon|georgette|net|organza|tulle|sheer/i,
    descriptor: "gentle backlight that reveals the fabric's translucency without overexposing it",
  },
  {
    match: /velvet/i,
    descriptor: "soft frontal fill with minimal hard shadow, so the texture doesn't crush into pure black",
  },
  {
    match: /cotton|linen|khadi|denim|jute/i,
    descriptor: "a raking side-light that reveals the weave and surface texture",
  },
  {
    match: /brocade|jacquard|zari|embroider|embellish/i,
    descriptor: "a raking side-light angled to catch metallic thread and embroidery texture without harsh glare",
  },
];

const DEFAULT_LIGHTING = "soft, even studio lighting flattering to both fabric and skin tone";

/**
 * Best-effort match against Product.material/pattern free text. Falls back
 * to a safe generic descriptor when material is unknown or unmatched —
 * every reel shot gets SOME lighting instruction now, never none.
 */
export function lightingDescriptorFor(material: string | null | undefined, pattern?: string | null): string {
  const text = `${material ?? ""} ${pattern ?? ""}`.trim();
  if (!text) return DEFAULT_LIGHTING;
  const hit = MATERIAL_LIGHTING.find((m) => m.match.test(text));
  return hit?.descriptor ?? DEFAULT_LIGHTING;
}
