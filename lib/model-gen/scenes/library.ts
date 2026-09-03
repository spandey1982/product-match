/**
 * Scene Library — the Scenic Collection's content, not code.
 *
 * Launch set: 8 scenes across 5 Brand Packs, chosen to prove BOTH scene
 * categories described in the brief:
 *  - "varies" scenes (Wedding, Diwali, Eid, Summer, Winter) — a recognizable
 *    identity that never repeats the exact same environment.
 *  - "consistent" scenes (Boutique, Editorial, Corporate) — a single curated
 *    layout, chosen when repeatability itself is the brand promise.
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
    id: "wedding",
    label: "Wedding",
    brandPack: "festive",
    variationPolicy: "varies",
    cameraStyles: ["golden-hour", "evening", "indoor-studio"],
    palette: {
      base: ["warm ivory", "soft gold", "champagne"],
      accent: ["emerald", "sapphire blue", "blush pink", "antique gold"],
      avoid: ["red", "maroon"],
    },
    variations: [
      {
        id: "mandap-hall",
        label: "Traditional Mandap Hall",
        environment: "an ornately decorated traditional mandap hall with carved wooden pillars and drifting sheer drapes",
        depth: {
          foreground: "a soft, blurred edge of floral mandap drapery",
          midground: "carved pillars framing the model with warm ambient glow",
          background: "a softly lit hall interior with a hint of floral canopy, out of focus",
        },
        decor: {
          minimal: ["a single strand of soft fairy lights"],
          classic: ["carved pillar detail", "soft floral garlands", "warm brass lanterns"],
          rich: ["carved pillar detail", "layered floral garlands", "brass lanterns", "sheer canopy drapery", "scattered rose petals underfoot"],
        },
      },
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
        id: "banquet-hall",
        label: "Grand Banquet Hall",
        environment: "an elegant banquet hall with soft chandeliers and draped fabric ceilings",
        depth: {
          foreground: "a blurred edge of a floral centrepiece",
          midground: "soft chandelier glow framing the model",
          background: "draped fabric ceiling and warm hall lighting, out of focus",
        },
        decor: {
          minimal: ["a single chandelier glow"],
          classic: ["chandelier glow", "draped ceiling fabric", "a low floral centrepiece"],
          rich: ["chandelier glow", "draped ceiling fabric", "floral centrepieces", "gold accent chairs", "soft uplighting on the walls"],
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
    negativeExtras: ["no wedding guests or officiant in frame", "no bridal party other than the single model"],
    recommendFor: { occasion: ["Wedding", "Bridal", "Anniversary"], styleTags: ["Bridal", "Royal", "Traditional"] },
  },
  {
    id: "diwali",
    label: "Diwali",
    brandPack: "festive",
    variationPolicy: "varies",
    cameraStyles: ["evening", "night", "indoor-studio"],
    palette: {
      base: ["warm amber", "deep terracotta", "burnished gold"],
      accent: ["emerald", "royal blue", "magenta", "gold"],
      avoid: ["orange", "yellow"],
    },
    variations: [
      {
        id: "traditional-courtyard",
        label: "Traditional Courtyard",
        environment: "a traditional Indian home courtyard glowing with rows of diyas at dusk",
        depth: {
          foreground: "a softly blurred row of terracotta diyas",
          midground: "a rangoli pattern on the courtyard floor beside the model",
          background: "warm-lit archways and a dusky sky, softly defocused",
        },
        decor: {
          minimal: ["a single row of diyas"],
          classic: ["diyas along the floor", "a rangoli pattern", "a marigold garland on the doorway"],
          rich: ["diyas along the floor and steps", "an elaborate rangoli", "marigold garlands", "brass lanterns", "string lights along the archway"],
        },
      },
      {
        id: "luxury-living-room",
        label: "Luxury Living Room",
        environment: "an elegant, softly lit living room decorated for Diwali with warm ambient lighting",
        depth: {
          foreground: "a blurred edge of a brass diya tray on a side table",
          midground: "warm festive lighting framing the model near a decorated console",
          background: "a softly furnished living room with festive accents, out of focus",
        },
        decor: {
          minimal: ["a single brass diya tray"],
          classic: ["a brass diya tray", "a small marigold arrangement", "warm string lights along a shelf"],
          rich: ["a brass diya tray", "marigold arrangements", "warm string lights", "festive floor cushions", "a lit rangoli motif rug"],
        },
      },
      {
        id: "outdoor-patio",
        label: "Outdoor Patio",
        environment: "an open outdoor patio strung with warm lights for a Diwali evening gathering",
        depth: {
          foreground: "a softly blurred potted marigold plant",
          midground: "warm string lights framing the model against the patio railing",
          background: "a dusky garden beyond the patio, softly defocused",
        },
        decor: {
          minimal: ["a single strand of warm lights"],
          classic: ["warm string lights", "potted marigolds", "a few floating diyas on a water bowl"],
          rich: ["warm string lights", "potted marigolds", "floating diyas", "lanterns hung along the railing", "a low rangoli near the steps"],
        },
      },
      {
        id: "modern-apartment",
        label: "Modern Apartment",
        environment: "a contemporary apartment balcony softly decorated for Diwali against a city dusk",
        depth: {
          foreground: "a softly blurred string of fairy lights along the railing",
          midground: "clean modern railing lines framing the model",
          background: "a soft city skyline at dusk, out of focus",
        },
        decor: {
          minimal: ["a single small diya on the railing"],
          classic: ["a few diyas on the railing", "fairy lights", "a small potted plant"],
          rich: ["diyas along the railing", "fairy lights", "potted plants", "a festive lantern", "a folded rangoli-print cushion"],
        },
      },
      {
        id: "heritage-entrance",
        label: "Heritage Entrance",
        environment: "the lit entrance of a heritage haveli decorated for Diwali with lanterns and rangoli",
        depth: {
          foreground: "a softly blurred hand-painted rangoli at the threshold",
          midground: "carved doorway and hanging lanterns framing the model",
          background: "a warmly lit inner courtyard glimpsed beyond, softly defocused",
        },
        decor: {
          minimal: ["a single lantern by the door"],
          classic: ["hanging lanterns", "a rangoli at the threshold", "a marigold garland on the door"],
          rich: ["hanging lanterns", "an elaborate rangoli", "marigold garlands", "diyas along the steps", "brass urli with floating flowers"],
        },
      },
    ],
    brandingHint: { preferredLogo: "light", brightness: 0.4 },
    theme: { icon: "Flame", color: "#D97706" },
    negativeExtras: ["no visible flames beyond small diya lamps", "no fireworks or smoke"],
    recommendFor: { occasion: ["Festive", "Traditional", "Religious"], styleTags: ["Traditional", "Festive", "Ethnic"] },
  },
  {
    id: "eid",
    label: "Eid",
    brandPack: "festive",
    variationPolicy: "varies",
    cameraStyles: ["evening", "night"],
    palette: {
      base: ["soft moonlit silver", "warm ivory", "deep teal"],
      accent: ["emerald", "gold", "sapphire"],
      avoid: ["green"],
    },
    variations: [
      {
        id: "moonlit-courtyard",
        label: "Moonlit Courtyard",
        environment: "a serene courtyard under soft moonlight with geometric lattice screens",
        depth: {
          foreground: "a softly blurred lattice (jali) screen edge",
          midground: "a carved jali screen casting soft patterned light near the model",
          background: "a moonlit courtyard fading into soft darkness, out of focus",
        },
        decor: {
          minimal: ["a single hanging lantern"],
          classic: ["a carved jali screen", "hanging lanterns", "a crescent-motif light fixture"],
          rich: ["a carved jali screen", "hanging lanterns", "a crescent-motif fixture", "floor cushions", "a low brass tray of dates"],
        },
      },
      {
        id: "majlis-lounge",
        label: "Majlis Lounge",
        environment: "an elegant majlis-style lounge with low seating and warm lantern light",
        depth: {
          foreground: "a softly blurred low brass tray",
          midground: "low floor cushions and warm lantern glow framing the model",
          background: "richly patterned lounge cushions and drapery, softly defocused",
        },
        decor: {
          minimal: ["a single lantern"],
          classic: ["floor cushions", "a brass lantern", "a patterned floor rug"],
          rich: ["floor cushions", "brass lanterns", "a patterned rug", "a low brass tray with dates", "sheer drapery panels"],
        },
      },
      {
        id: "garden-terrace",
        label: "Garden Terrace",
        environment: "a quiet garden terrace at dusk strung with soft lantern lights",
        depth: {
          foreground: "a softly blurred potted palm",
          midground: "hanging lanterns framing the model against the terrace railing",
          background: "a dusky garden beyond, softly defocused",
        },
        decor: {
          minimal: ["a single hanging lantern"],
          classic: ["hanging lanterns", "potted palms", "a folded prayer rug motif cushion"],
          rich: ["hanging lanterns", "potted palms", "a cushion vignette", "string lights along the railing", "a small water feature"],
        },
      },
      {
        id: "ornate-palace-hall",
        label: "Ornate Palace Hall",
        environment: "an ornate palace hall with geometric tilework and soft warm lighting",
        depth: {
          foreground: "a softly blurred edge of geometric tile detail",
          midground: "an archway with tilework framing the model",
          background: "a grand hall interior with soft warm light, out of focus",
        },
        decor: {
          minimal: ["a single lantern near the archway"],
          classic: ["a tiled archway", "hanging lanterns", "a low brass urli"],
          rich: ["a tiled archway", "hanging lanterns", "a brass urli with petals", "patterned floor rugs", "sheer drapery"],
        },
      },
      {
        id: "rooftop-evening",
        label: "Rooftop Evening Gathering",
        environment: "an open rooftop set for an Eid evening gathering under a soft dusk sky",
        depth: {
          foreground: "a softly blurred string of warm lights along the railing",
          midground: "warm lantern glow framing the model against the skyline",
          background: "a soft city skyline at dusk, out of focus",
        },
        decor: {
          minimal: ["a single strand of warm lights"],
          classic: ["warm string lights", "a low seating vignette", "potted plants"],
          rich: ["warm string lights", "a seating vignette", "potted plants", "lanterns", "a low table with dates and sweets"],
        },
      },
    ],
    brandingHint: { preferredLogo: "light", brightness: 0.45 },
    theme: { icon: "Moon", color: "#2DBE9C" },
    negativeExtras: ["no religious text or calligraphy rendered as legible writing", "no crescent-moon iconography used as a literal graphic overlay"],
    recommendFor: { occasion: ["Religious", "Festive", "Traditional"], styleTags: ["Traditional", "Ethnic", "Festive"] },
  },

  // ── Nature pack ──────────────────────────────────────────────────────────
  {
    id: "summer",
    label: "Summer",
    brandPack: "nature",
    variationPolicy: "varies",
    cameraStyles: ["morning", "soft-daylight", "golden-hour"],
    palette: {
      base: ["soft ivory", "sandy beige", "sky blue"],
      accent: ["coral", "citrus yellow", "seafoam green"],
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
        id: "poolside-terrace",
        label: "Poolside Terrace",
        environment: "a bright poolside terrace with clean white loungers and soft water reflections",
        depth: {
          foreground: "a softly blurred edge of a woven sun lounger",
          midground: "soft water reflections framing the model",
          background: "a calm pool and clear sky, out of focus",
        },
        decor: {
          minimal: ["a single woven lounger edge"],
          classic: ["a woven lounger", "a potted palm", "soft water reflections"],
          rich: ["woven loungers", "potted palms", "water reflections", "a striped sun umbrella", "citrus fruit in a bowl on a side table"],
        },
      },
      {
        id: "botanical-greenhouse",
        label: "Botanical Greenhouse",
        environment: "a bright botanical greenhouse with lush leafy plants and soft filtered light",
        depth: {
          foreground: "a softly blurred large leaf",
          midground: "lush greenery framing the model with soft filtered light",
          background: "a glass greenhouse structure with plants beyond, out of focus",
        },
        decor: {
          minimal: ["a few leafy plants"],
          classic: ["leafy plants", "hanging ferns", "a wicker planter"],
          rich: ["leafy plants", "hanging ferns", "wicker planters", "a small water feature", "scattered light through glass panes"],
        },
      },
      {
        id: "coastal-veranda",
        label: "Coastal Veranda",
        environment: "an airy coastal veranda with sheer white curtains drifting in a sea breeze",
        depth: {
          foreground: "a softly blurred drifting sheer curtain",
          midground: "sheer white curtains framing the model",
          background: "a soft coastal view beyond the veranda, out of focus",
        },
        decor: {
          minimal: ["a single drifting sheer curtain"],
          classic: ["sheer curtains", "a rattan chair", "a potted seagrass plant"],
          rich: ["sheer curtains", "a rattan chair", "seagrass planters", "a woven rug", "a driftwood accent table"],
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
    recommendFor: { season: ["Summer", "Spring", "All Season"], occasion: ["Casual", "Party"], styleTags: ["Casual", "Boho"] },
  },
  {
    id: "winter",
    label: "Winter",
    brandPack: "nature",
    variationPolicy: "varies",
    cameraStyles: ["soft-daylight", "morning", "indoor-studio"],
    palette: {
      base: ["cool frost white", "soft slate grey", "warm cocoa"],
      accent: ["deep forest green", "burgundy", "warm amber"],
      avoid: ["white", "grey"],
    },
    variations: [
      {
        id: "frosted-garden",
        label: "Frosted Garden",
        environment: "a quiet garden lightly dusted with frost under soft winter daylight",
        depth: {
          foreground: "a softly blurred frost-dusted branch",
          midground: "bare, frost-touched shrubs framing the model",
          background: "a soft, misty winter garden, out of focus",
        },
        decor: {
          minimal: ["a single frost-dusted branch"],
          classic: ["frost-dusted branches", "a stone garden bench", "soft morning mist"],
          rich: ["frost-dusted branches", "a stone bench", "morning mist", "a scattering of fallen leaves", "a small frozen pond edge"],
        },
      },
      {
        id: "alpine-lodge",
        label: "Alpine Lodge Interior",
        environment: "a cosy alpine lodge interior with warm wood panelling and soft firelight",
        depth: {
          foreground: "a softly blurred wool throw draped over a chair",
          midground: "warm wood panelling and soft firelight framing the model",
          background: "a lodge interior with a glowing fireplace, out of focus",
        },
        decor: {
          minimal: ["a single wool throw"],
          classic: ["a wool throw", "a glowing fireplace", "a wooden side table"],
          rich: ["a wool throw", "a glowing fireplace", "a wooden side table", "a stack of firewood", "warm hanging string lights"],
        },
      },
      {
        id: "snow-dusted-courtyard",
        label: "Snow-Dusted Courtyard",
        environment: "a heritage courtyard lightly dusted with snow under soft overcast light",
        depth: {
          foreground: "a softly blurred snow-dusted stone ledge",
          midground: "snow-dusted archways framing the model",
          background: "a soft, muted courtyard beyond, out of focus",
        },
        decor: {
          minimal: ["a single snow-dusted ledge"],
          classic: ["a snow-dusted ledge", "bare branches", "a stone lantern"],
          rich: ["a snow-dusted ledge", "bare branches", "a stone lantern", "soft snowfall in the air", "a wrought-iron bench"],
        },
      },
      {
        id: "fireplace-lounge",
        label: "Fireplace Lounge",
        environment: "an elegant lounge with a crackling fireplace and warm ambient light",
        depth: {
          foreground: "a softly blurred edge of a velvet armchair",
          midground: "warm fireplace glow framing the model",
          background: "a softly lit lounge interior, out of focus",
        },
        decor: {
          minimal: ["a single fireplace glow"],
          classic: ["a fireplace", "a velvet armchair", "a wool throw"],
          rich: ["a fireplace", "a velvet armchair", "a wool throw", "a stack of books on a side table", "soft candlelight accents"],
        },
      },
      {
        id: "pine-forest-edge",
        label: "Pine Forest Edge",
        environment: "the edge of a quiet pine forest with soft winter light filtering through the trees",
        depth: {
          foreground: "a softly blurred pine branch",
          midground: "tall pine trunks framing the model",
          background: "a soft, misty pine forest, out of focus",
        },
        decor: {
          minimal: ["a single pine branch"],
          classic: ["pine branches", "a fallen log", "soft ground mist"],
          rich: ["pine branches", "a fallen log", "ground mist", "a scattering of pinecones", "soft filtered light shafts"],
        },
      },
    ],
    brandingHint: { preferredLogo: "dark", brightness: 0.78 },
    theme: { icon: "Snowflake", color: "#5B8DBE" },
    recommendFor: { season: ["Winter", "Autumn"], styleTags: ["Formal", "Contemporary"] },
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
