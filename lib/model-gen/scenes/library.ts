/**
 * Scene Library — the Scenic Collection's content, not code.
 *
 * Current set: 7 scenes across 6 Brand Packs, chosen to prove BOTH scene
 * categories described in the brief:
 *  - "varies" scenes (Royal Heritage, Festive, Nature, Street Style) — a
 *    recognizable identity that never repeats the exact same environment.
 *  - "consistent" scenes (Boutique, Editorial, Corporate) — a single curated
 *    layout, chosen when repeatability itself is the brand promise.
 *
 * ── Refactor (2026-09, direct user decision) ─────────────────────────────
 * The original launch set had five festival/season scenes (Wedding, Diwali,
 * Eid, Summer, Winter) — narrower and more calendar-specific than how real
 * retailers actually catalogue year-round. Consolidated per direct user
 * brief:
 *  - Wedding → "Royal Heritage": same grandeur/heritage identity, trimmed to
 *    its 3 strongest variations (Palace Courtyard, Heritage Haveli Entrance,
 *    Rooftop Sunset) — dropped Mandap Hall and Banquet Hall as more
 *    generic/replaceable event-hall settings.
 *  - Diwali + Eid → one generic "Festive" scene, holiday-agnostic (no diya/
 *    rangoli/crescent-moon iconography tied to one specific festival), whose
 *    decor RICHNESS is decided by the garment's own fabric weight rather
 *    than a manual slider — see Scene.autoDensityFromMaterial. Heavy/
 *    structured fabric reads richer, with more ornate/antique/shining props
 *    and warmer lighting; light/flowing fabric reads minimal and subtle,
 *    muted colours, never bright or contrasting.
 *  - Summer + Winter → one generic "Nature" scene, winter dropped entirely
 *    (frost/snow/fireplace settings don't fit this platform's dominant
 *    category — Indian ethnic wear isn't typically shot in winter cold).
 *    Kept strictly to bright, sunlit outdoor park/viewpoint settings —
 *    mostly summer-evening light, with autumn/spring-appropriate variations
 *    (an orchard, an elevated viewpoint) folded in rather than surfaced as
 *    their own season chip.
 *
 * ── Adding a new scene later ─────────────────────────────────────────────
 * This is the ENTIRE point of the Scene Library pattern: a new scene is pure
 * data, zero architecture changes. Copy the template below, fill it in, push
 * it into SCENES. Nothing else needs to change (engine.ts, prompt-sets.ts,
 * the UI, and settings all read SCENES generically).
 *
 *   {
 *     id: "resort", label: "Resort", brandPack: "nature",
 *     variationPolicy: "varies", // or "consistent" for a single fixed layout
 *     cameraStyles: ["golden-hour", "soft-daylight"], // first = default
 *     palette: { base: [...], accent: [...], avoid: [...] },
 *     variations: [
 *       { id: "...", label: "...", environment: "one-sentence description",
 *         depth: { foreground: "...", midground: "...", background: "..." },
 *         decor: { minimal: [...], classic: [...], rich: [...] } },
 *       // 4-5 curated variations for "varies"; exactly 1 for "consistent"
 *     ],
 *     brandingHint: { preferredLogo: "dark" | "light", brightness: 0.0-1.0 },
 *     negativeExtras: ["scene-specific constraint", ...], // optional
 *     recommendFor: { occasion: [...], styleTags: [...], season: [...], categories: [...] },
 *   }
 *
 * ── Future roster (documented, not yet authored) ────────────────────────
 * Naming one of these to a future session is enough context to author it —
 * see docs/IMAGE_AI_ROADMAP.md §12 for the full table with proposed packs:
 *   Luxury Store · Resort · Café · Street Fashion · Office · Runway ·
 *   Heritage Architecture · Beach · Temple · Garden · Studio Interior
 *
 * ── Camera style guidance (2026-09, direct user decision) ────────────────
 * Avoid outdoor night settings ("night", or "evening" read as after-dark)
 * for everyday/ethnic-wear-oriented packs — live-tested and found to cause
 * real rendering defects (foot placement, silhouette grounding) from the
 * model/fabric interacting with scattered artificial light sources, and
 * this platform's dominant category (Indian ethnic wear) isn't typically
 * shot at night in real practice anyway. Party/western-wear packs are the
 * legitimate exception. Where a night mood is genuinely wanted, keep it
 * INDOOR (a well-lit hall or room) rather than outdoor — see Diwali/Eid's
 * indoor evening variations (luxury-living-room, majlis-lounge) for the
 * pattern: rich, controlled ambient light, not open/scattered night light.
 */
import type { Scene } from "./types";

export const SCENES: Scene[] = [
  // ── Festive pack ────────────────────────────────────────────────────────
  {
    id: "royal-heritage",
    label: "Royal Heritage",
    brandPack: "festive",
    variationPolicy: "varies",
    cameraStyles: ["golden-hour", "evening"],
    palette: {
      base: ["warm ivory", "soft gold", "champagne"],
      accent: ["emerald", "sapphire blue", "blush pink", "antique gold"],
      avoid: ["red", "maroon"],
    },
    variations: [
      {
        id: "palace-courtyard",
        label: "Palace Courtyard",
        environment: "a grand heritage palace courtyard at dusk with sandstone archways",
        depth: {
          foreground: "a softly blurred stone balustrade edge",
          midground: "sandstone archways catching the last warm light",
          background: "a palace facade fading into dusky sky, softly defocused",
        },
        decor: {
          minimal: ["a single glowing lantern"],
          classic: ["sandstone jali screen", "a row of glowing lanterns", "potted jasmine"],
          rich: ["sandstone jali screen", "rows of glowing lanterns", "potted jasmine", "draped marigold strands", "a distant fountain"],
        },
      },
      {
        id: "heritage-haveli",
        label: "Heritage Haveli Entrance",
        environment: "the ornate entrance of a heritage haveli with intricately carved wooden doors",
        depth: {
          foreground: "a softly blurred brass door handle detail",
          midground: "carved wooden doorway framing the model",
          background: "a sunlit inner courtyard glimpsed beyond, softly defocused",
        },
        decor: {
          minimal: ["a single hanging marigold string"],
          classic: ["carved door detail", "hanging marigold strings", "a brass diya at the threshold"],
          rich: ["carved door detail", "layered marigold strings", "brass diyas", "a hand-painted rangoli at the threshold", "potted tulsi plants"],
        },
      },
      {
        id: "rooftop-sunset",
        label: "Rooftop Sunset Venue",
        environment: "an open rooftop wedding venue overlooking the city at golden hour",
        depth: {
          foreground: "a softly blurred edge of draped fairy-lit canopy",
          midground: "a warm golden skyline framing the model",
          background: "a soft city skyline silhouette at dusk, out of focus",
        },
        decor: {
          minimal: ["a single string of warm fairy lights"],
          classic: ["fairy-lit canopy edge", "a low floral arrangement", "soft string lighting along the railing"],
          rich: ["fairy-lit canopy", "floral arrangements", "string lighting", "draped sheer fabric panels", "a lounge seating vignette"],
        },
      },
    ],
    brandingHint: { preferredLogo: "light", brightness: 0.55 },
    theme: { icon: "Gem", color: "#B8860B" },
    negativeExtras: ["no crowd of onlookers, guests or event staff in frame — the model is the only person shown"],
    recommendFor: { occasion: ["Wedding", "Bridal", "Anniversary", "Reception"], styleTags: ["Bridal", "Royal", "Traditional"] },
  },
  // Merged from the former Diwali + Eid scenes — holiday-agnostic on
  // purpose (see the file header's 2026-09 refactor note): no diya/rangoli/
  // crescent-moon iconography tied to one specific festival. Decor richness
  // is automatic (autoDensityFromMaterial), not a manual slider.
  {
    id: "festive",
    label: "Festive",
    brandPack: "festive",
    variationPolicy: "varies",
    autoDensityFromMaterial: true,
    cameraStyles: ["evening", "indoor-studio"],
    palette: {
      base: ["warm amber", "deep terracotta", "burnished gold"],
      accent: ["emerald", "royal blue", "magenta", "gold"],
      avoid: ["orange", "yellow"],
    },
    variations: [
      {
        id: "lantern-lit-courtyard",
        label: "Lantern-Lit Courtyard",
        cameraStyle: "evening",
        environment: "a traditional Indian home courtyard warmly lit at dusk",
        depth: {
          foreground: "a softly blurred row of small lamps",
          midground: "warm-lit archways framing the model",
          background: "a dusky courtyard sky, softly defocused",
        },
        decor: {
          minimal: ["a single small lamp, softly muted"],
          classic: ["a row of small lamps", "a floral garland on the doorway"],
          rich: ["lamps along the floor and steps", "layered floral garlands", "antique brass lanterns", "warm string lights along the archway", "a shimmering metallic-thread runner underfoot"],
        },
      },
      {
        id: "festive-living-room",
        label: "Festive Living Room",
        cameraStyle: "indoor-studio",
        environment: "an elegant, softly lit living room decorated for a festive occasion with warm ambient lighting",
        depth: {
          foreground: "a blurred edge of a side table",
          midground: "warm festive lighting framing the model near a decorated console",
          background: "a softly furnished living room with festive accents, out of focus",
        },
        decor: {
          minimal: ["a single small floral arrangement, subdued in colour"],
          classic: ["a brass tray", "a small floral arrangement", "warm string lights along a shelf"],
          rich: ["an antique brass tray", "shining floral arrangements", "warm string lights", "festive floor cushions with metallic embroidery", "a softly gleaming decorative rug"],
        },
      },
      {
        id: "festive-garden-terrace",
        label: "Garden Terrace Evening",
        cameraStyle: "evening",
        environment: "a quiet garden terrace at dusk strung with soft warm lights",
        depth: {
          foreground: "a softly blurred potted plant",
          midground: "warm lights framing the model against the terrace railing",
          background: "a dusky garden beyond, softly defocused",
        },
        decor: {
          minimal: ["a single potted plant, muted tones"],
          classic: ["a strand of warm lights", "potted plants"],
          rich: ["warm string lights", "potted plants with brass planters", "hanging lanterns", "a shimmering cushion vignette", "a low table set with a gleaming brass tray"],
        },
      },
      {
        id: "heritage-hall",
        label: "Heritage Hall",
        cameraStyle: "indoor-studio",
        environment: "an ornate heritage hall with warm architectural lighting",
        depth: {
          foreground: "a softly blurred edge of an archway",
          midground: "an archway framing the model",
          background: "a grand hall interior with soft warm light, out of focus",
        },
        decor: {
          minimal: ["a single lantern near the archway, softly muted"],
          classic: ["a tiled or carved archway", "a hanging lantern"],
          rich: ["an ornately tiled archway", "antique hanging lanterns", "a gleaming brass urli with floating flowers", "patterned floor rugs", "sheer drapery catching the light"],
        },
      },
    ],
    brandingHint: { preferredLogo: "light", brightness: 0.4 },
    theme: { icon: "Flame", color: "#D97706" },
    negativeExtras: [
      "no visible flames beyond small lamp-style lighting",
      "no fireworks or smoke",
      "no religious text, calligraphy, or religious iconography rendered as a literal graphic",
    ],
    recommendFor: { occasion: ["Festive", "Traditional", "Religious"], styleTags: ["Traditional", "Festive", "Ethnic"] },
  },

  // ── Nature pack ──────────────────────────────────────────────────────────
  // Merged from the former Summer + Winter scenes — winter dropped entirely
  // (frost/snow/fireplace settings don't fit this platform's dominant
  // category; see the file header's 2026-09 refactor note). Strictly bright,
  // sunlit outdoor park/viewpoint settings — mostly summer-evening light,
  // with autumn/spring folded in via warm-afternoon variations rather than
  // surfaced as their own season chip.
  {
    id: "nature",
    label: "Nature",
    brandPack: "nature",
    variationPolicy: "varies",
    cameraStyles: ["soft-daylight", "morning", "golden-hour"],
    palette: {
      base: ["soft ivory", "sandy beige", "sky blue"],
      accent: ["coral", "warm amber", "sage green"],
      avoid: ["yellow", "orange"],
    },
    variations: [
      {
        id: "sunlit-garden",
        label: "Sunlit Garden",
        environment: "a bright, sunlit garden with soft green foliage and dappled light",
        depth: {
          foreground: "a softly blurred cluster of light florals",
          midground: "dappled sunlight through leaves near the model",
          background: "a soft green garden expanse, out of focus",
        },
        decor: {
          minimal: ["a few light florals at the edge of frame"],
          classic: ["light florals", "soft green foliage", "a wooden garden bench"],
          rich: ["light florals", "soft green foliage", "a wooden bench", "a trailing vine arch", "scattered petals on the grass"],
        },
      },
      {
        id: "open-parkland",
        label: "Open Parkland",
        environment: "a sunlit open parkland with scattered trees and soft green lawns, away from any street or path",
        depth: {
          foreground: "a softly blurred patch of tall grass",
          midground: "scattered trees framing the model across the open lawn",
          background: "rolling green lawns fading into soft distance, out of focus",
        },
        decor: {
          minimal: ["a single scattered tree at the edge of frame"],
          classic: ["scattered trees", "open green lawn", "soft wildflowers underfoot"],
          rich: ["scattered trees", "open green lawn", "wildflowers", "a distant tree line", "dappled cloud shadow across the grass"],
        },
      },
      {
        id: "scenic-viewpoint",
        label: "Scenic Viewpoint",
        cameraStyle: "golden-hour",
        environment: "an elevated scenic viewpoint overlooking rolling hills or a valley under clear bright daylight",
        depth: {
          foreground: "a softly blurred low stone ledge or railing",
          midground: "open sky and distant hills framing the model",
          background: "rolling hills or a valley fading into soft haze, out of focus",
        },
        decor: {
          minimal: ["a single stone ledge edge"],
          classic: ["a stone ledge or railing", "soft grass at the model's feet", "distant hills"],
          rich: ["a stone ledge or railing", "soft grass", "wildflowers at the edge", "distant hills", "warm golden haze over the valley"],
        },
      },
      {
        id: "citrus-orchard",
        label: "Citrus Orchard",
        environment: "a sunlit citrus orchard with soft green rows and warm afternoon light",
        depth: {
          foreground: "a softly blurred citrus branch with fruit",
          midground: "orchard rows framing the model in warm light",
          background: "a soft green orchard expanse, out of focus",
        },
        decor: {
          minimal: ["a single citrus branch at the edge of frame"],
          classic: ["citrus branches", "soft grass underfoot", "a wooden crate of fruit"],
          rich: ["citrus branches", "grass underfoot", "a wooden fruit crate", "a woven picnic blanket", "scattered fallen leaves"],
        },
      },
    ],
    brandingHint: { preferredLogo: "dark", brightness: 0.85 },
    theme: { icon: "Sun", color: "#F2B705" },
    recommendFor: { season: ["Summer", "Spring", "Autumn", "All Season"], occasion: ["Casual", "Party"], styleTags: ["Casual", "Boho"] },
  },

  // ── Boutique pack (consistent) ──────────────────────────────────────────
  {
    id: "boutique",
    label: "Boutique",
    brandPack: "boutique",
    variationPolicy: "consistent",
    cameraStyles: ["indoor-studio", "soft-daylight"],
    palette: {
      base: ["warm taupe", "soft ivory", "brushed brass"],
      accent: ["dusty rose", "sage green"],
      avoid: ["beige", "brown"],
    },
    variations: [
      {
        id: "curated-boutique-interior",
        label: "Curated Boutique Interior",
        environment: "an upscale boutique interior with soft-focus garment racks and warm spotlighting",
        depth: {
          foreground: "a softly blurred edge of a polished display table",
          midground: "warm spotlighting framing the model against a clean boutique backdrop",
          background: "softly defocused garment racks and a polished floor",
        },
        decor: {
          minimal: ["a single softly blurred display rack"],
          classic: ["a soft-focus garment rack", "a polished floor reflection", "a brushed brass rail"],
          rich: ["a soft-focus garment rack", "a polished floor reflection", "a brushed brass rail", "a low display table with folded fabrics", "warm accent spotlighting"],
        },
      },
    ],
    brandingHint: { preferredLogo: "dark", brightness: 0.82 },
    theme: { icon: "ShoppingBag", color: "#A9745B" },
    negativeExtras: ["no legible signage or price tags", "no other shoppers in frame"],
    recommendFor: { occasion: ["Casual", "Formal"], styleTags: ["Minimalist", "Contemporary"] },
  },

  // ── Editorial pack (consistent) ─────────────────────────────────────────
  {
    id: "editorial",
    label: "Editorial",
    brandPack: "editorial",
    variationPolicy: "consistent",
    cameraStyles: ["indoor-studio"],
    palette: {
      base: ["seamless charcoal", "seamless ivory", "muted terracotta"],
      accent: ["bold cobalt", "acid green"],
      avoid: ["grey", "white"],
    },
    variations: [
      {
        id: "minimalist-editorial-set",
        label: "Minimalist Editorial Set",
        environment: "a bold, minimalist editorial studio set with a seamless colour backdrop and dramatic single-source lighting",
        depth: {
          foreground: "clean, empty negative space",
          midground: "a single dramatic light source sculpting the model",
          background: "a seamless, gently gradated colour backdrop",
        },
        decor: {
          minimal: [],
          classic: ["a single sculptural prop at the frame edge"],
          rich: ["a single sculptural prop", "a subtle graphic shadow pattern on the backdrop"],
        },
      },
    ],
    brandingHint: { preferredLogo: "light", brightness: 0.35 },
    theme: { icon: "Aperture", color: "#1F1F23" },
    negativeExtras: ["no busy or cluttered backdrop", "no more than one graphic element in frame"],
    recommendFor: { styleTags: ["Contemporary", "Fusion", "Boho"], occasion: ["Party"] },
  },

  // ── Street pack (varies) ─────────────────────────────────────────────────
  // Authored from direct competitor benchmarking (karchobi.in, 2026-09) —
  // fills the "Café" / "Street Fashion" slots this file's own future-roster
  // comment has named since launch but never authored. Every karchobi photo
  // inspected used one of these five settings; bundled under one scene
  // identity the same way Wedding bundles mandap/palace/banquet/haveli/
  // rooftop under itself, rather than splitting into two separate scenes.
  //
  // Deliberately all-daytime (2026-09, direct user guidance): an outdoor
  // night variation ("Evening City Street") was authored and live-tested
  // here first, but outdoor night lighting proved genuinely hard to render
  // reliably — model/fabric interaction with far, scattered artificial
  // light sources produced real defects (foot placement, silhouette
  // grounding) that daytime renders didn't have. This platform's dominant
  // category is Indian ethnic wear, which isn't typically shot at night in
  // real practice anyway — party/western wear is the exception, not the
  // rule, and belongs in its own future pack rather than bent into Street
  // Style's everyday-casual identity. GUIDANCE FOR FUTURE SCENES: avoid
  // outdoor night generally; where a night mood is genuinely called for
  // (e.g. a future party/evening-glam pack), keep it INDOOR — a well-lit
  // hall or room gives the rich, controlled ambient light that fabric and
  // model rendering actually need, without outdoor night's uncontrolled,
  // scattered light sources.
  {
    id: "street-style",
    label: "Street Style",
    brandPack: "street",
    variationPolicy: "varies",
    cameraStyles: ["soft-daylight", "golden-hour", "outdoor"],
    palette: {
      base: ["warm stone grey", "sandy taupe", "weathered concrete"],
      accent: ["terracotta", "warm brass", "deep olive green"],
      avoid: ["grey", "beige"],
    },
    variations: [
      {
        id: "cafe-patio",
        label: "Café Patio",
        environment: "an outdoor café patio with woven rattan furniture and lush potted plants, softly shaded from direct sun",
        depth: {
          foreground: "a softly blurred cluster of potted plant leaves at the frame edge",
          midground: "rattan café chairs and low tables framing the model",
          background: "more potted greenery and the café's stone facade, softly defocused",
        },
        decor: {
          minimal: ["a single potted plant"],
          classic: ["potted plants", "a rattan chair", "a stone planter"],
          rich: ["potted plants", "rattan furniture", "stone planters", "a folded café umbrella", "scattered fallen leaves on the pavement"],
        },
      },
      {
        id: "high-street-walkway",
        label: "High Street Walkway",
        cameraStyle: "golden-hour",
        environment: "an upscale open-air high-street shopping promenade with polished stone paving and storefront awnings",
        depth: {
          foreground: "a softly blurred café table at the frame edge",
          midground: "storefront glass and warm awnings framing the model",
          background: "a row of boutique facades receding down the promenade, softly defocused",
        },
        decor: {
          minimal: ["a single storefront awning edge"],
          classic: ["storefront awnings", "potted topiary", "polished stone paving"],
          rich: ["storefront awnings", "potted topiary", "stone paving", "string café lights overhead", "a parked bicycle at the edge of frame"],
        },
      },
      {
        id: "tree-lined-avenue",
        label: "Tree-Lined Avenue",
        environment: "a leafy tree-lined city avenue with dappled sunlight filtering through the canopy",
        depth: {
          foreground: "a softly blurred low sidewalk café table",
          midground: "tree trunks and hanging branches framing the model",
          background: "a soft green canopy tunnel of trees receding down the avenue, out of focus",
        },
        decor: {
          minimal: ["a single tree trunk at the frame edge"],
          classic: ["tree trunks", "a sidewalk café table", "fallen leaves underfoot"],
          rich: ["tree trunks", "a sidewalk café table", "fallen leaves", "a parked vintage bicycle", "distant storefronts glimpsed through the trees"],
        },
      },
      {
        id: "city-park-pathway",
        label: "City Park Pathway",
        environment: "a sunlit city park pathway lined with trees and open green lawns",
        depth: {
          foreground: "a softly blurred park bench edge",
          midground: "a tree-lined gravel path framing the model",
          background: "open green lawns and distant trees, softly defocused",
        },
        decor: {
          minimal: ["a single park bench"],
          classic: ["a park bench", "scattered trees", "a gravel path"],
          rich: ["a park bench", "scattered trees", "a gravel path", "a distant fountain", "a few fallen leaves on the path"],
        },
      },
      {
        id: "boutique-lined-lane",
        label: "Boutique-Lined Lane",
        environment: "a quiet cobblestone pedestrian lane lined with small independent boutiques and hanging planters",
        depth: {
          foreground: "a softly blurred hanging planter box",
          midground: "cobblestone paving and boutique doorways framing the model",
          background: "the lane curving away with more storefronts, softly defocused",
        },
        decor: {
          minimal: ["a single hanging planter"],
          classic: ["hanging planters", "cobblestone texture", "a painted boutique door"],
          rich: ["hanging planters", "cobblestones", "painted doors", "a bicycle leaning against a wall", "a chalkboard café sign"],
        },
      },
    ],
    brandingHint: { preferredLogo: "dark", brightness: 0.8 },
    theme: { icon: "Footprints", color: "#8A8378" },
    negativeExtras: [
      "no other pedestrians or crowds in frame — the model is the only person shown",
      "no legible shop signage, brand names, or logos anywhere in the scene",
      "no vehicles, bicycles or license plates rendered in sharp, legible focus",
    ],
    recommendFor: { occasion: ["Casual", "Everyday"], styleTags: ["Casual", "Contemporary"], season: ["All Season"] },
  },

  // ── Corporate pack (consistent) ─────────────────────────────────────────
  {
    id: "corporate",
    label: "Corporate",
    brandPack: "corporate",
    variationPolicy: "consistent",
    cameraStyles: ["soft-daylight", "indoor-studio"],
    palette: {
      base: ["cool slate grey", "warm white", "brushed steel"],
      accent: ["muted navy", "soft teal"],
      avoid: ["blue", "grey"],
    },
    variations: [
      {
        id: "modern-office-lounge",
        label: "Modern Office Lounge",
        environment: "a modern office lounge with clean glass partitions and soft ambient daylight",
        depth: {
          foreground: "a softly blurred edge of a glass partition",
          midground: "clean architectural lines framing the model",
          background: "a softly defocused open-plan office beyond the glass",
        },
        decor: {
          minimal: ["a single glass partition edge"],
          classic: ["a glass partition", "a low upholstered bench", "a potted plant"],
          rich: ["a glass partition", "an upholstered bench", "potted plants", "a minimalist side table", "soft ambient pendant lighting"],
        },
      },
    ],
    brandingHint: { preferredLogo: "dark", brightness: 0.8 },
    theme: { icon: "Briefcase", color: "#33415C" },
    negativeExtras: ["no legible screens, documents or signage"],
    recommendFor: { occasion: ["Office", "Formal"], styleTags: ["Minimalist", "Traditional"] },
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

export function isSceneId(v: unknown): v is string {
  return typeof v === "string" && SCENES.some((s) => s.id === v);
}

export const DEFAULT_SCENE_ID = SCENES[0].id;

/** Brand Pack metadata for grouping scene rows in the UI. Order = display order. */
export interface BrandPackMeta {
  id: string;
  label: string;
}

export const BRAND_PACKS: BrandPackMeta[] = [
  { id: "festive", label: "Festive Collection" },
  { id: "nature", label: "Nature Collection" },
  { id: "street", label: "Street Style Collection" },
  { id: "boutique", label: "Boutique Collection" },
  { id: "editorial", label: "Editorial Collection" },
  { id: "corporate", label: "Corporate Collection" },
];

/**
 * Lightweight view the chooser UI needs (no internal profiles). There's no
 * real photo to preview, so the identity is an icon + accent colour
 * (`theme`) rather than a rendered thumbnail — see Scene.theme.
 */
export interface SceneOptionView {
  id: string;
  label: string;
  brandPack: string;
  variationPolicy: Scene["variationPolicy"];
  icon: string;
  color: string;
}

export function listSceneOptions(): SceneOptionView[] {
  return SCENES.map((s) => ({
    id: s.id,
    label: s.label,
    brandPack: s.brandPack,
    variationPolicy: s.variationPolicy,
    icon: s.theme.icon,
    color: s.theme.color,
  }));
}
