/**
 * Material Knowledge — the "what type of material should I consider?"
 * layer, independent of any SKU (docs/home-material/README.md §12,
 * AI-boundaries table: "Material Knowledge... curated/config data, not
 * generated live per-request"). Single typed source of truth, seeded into
 * HmMaterial by scripts/seed-material-knowledge.ts and reusable directly
 * by application code (the guide page, lib/home-material/recommendation.ts)
 * without re-reading the seed script.
 *
 * Curated by Claude, not sourced from live market data — durability/
 * maintenance/installation/moisture characteristics are established
 * general domain knowledge (India-market wall-material categories), low
 * risk of being wrong in a way that matters. The INR cost ranges are the
 * one genuinely uncertain part: indicative estimates only, not verified
 * against any current supplier/market data. Both facts are recorded here
 * deliberately (Constitution Principle 3 — separate facts from inference)
 * rather than silently presenting an estimate as verified. Flagged in
 * docs/home-material/README.md as needing real review before these
 * numbers inform an actual purchase decision.
 *
 * durabilityYearsApprox/maintenanceLevel/moistureLevel/costTier are
 * STRUCTURED restatements of the prose fields above (durability/
 * maintenance/moistureSuitability/cost range) — added for
 * lib/home-material/recommendation.ts's deterministic scorer, which needs
 * comparable values, not free text to parse. Not new claims: each was
 * derived directly from the prose already here, kept consistent with it.
 */

export type MaterialCategory = "paint" | "wallpaper" | "wall_texture" | "wall_panel";
export type MaintenanceLevel = "low" | "medium" | "high";
export type MoistureLevel = "poor" | "fair" | "good" | "excellent";
export type CostTier = "budget" | "mid" | "premium";

export interface MaterialTaxonomyEntry {
  /** Stable slug — used to derive the seeded HmMaterial.id, so re-seeding is idempotent. */
  slug: string;
  category: MaterialCategory;
  subtype: string;
  name: string;
  description: string;
  durability: string;
  maintenance: string;
  moistureSuitability: string;
  installationNotes: string;
  removalNotes: string;
  /** Indicative only — see file header. Material cost alone, not installation/labour. */
  avgCostPerSqftMinInr: number;
  avgCostPerSqftMaxInr: number;
  advantages: string[];
  limitations: string[];

  /** A single representative "typical years" figure derived from the `durability` prose above. */
  durabilityYearsApprox: number;
  /** How much upkeep effort it needs, derived from the `maintenance` prose above ("low" = least effort). */
  maintenanceLevel: MaintenanceLevel;
  /** Derived from the `moistureSuitability` prose above. */
  moistureLevel: MoistureLevel;
  /** Where this sits in the Indian market for its category — a judgment call, not mechanically derived from the cost numbers (installation/labour complexity varies a lot by category). */
  costTier: CostTier;
}

export const MATERIAL_TAXONOMY: MaterialTaxonomyEntry[] = [
  // ── Paint ──────────────────────────────────────────────────────────────
  {
    slug: "paint_emulsion_matte",
    category: "paint",
    subtype: "emulsion_matte",
    name: "Interior Emulsion — Matte",
    description: "The standard wall paint for Indian homes — a water-based matte finish, the default choice for bedrooms and living rooms.",
    durability: "5-7 years indoors before visible fading or chalking, less in direct sun exposure.",
    maintenance: "Wipeable but not fully washable — vigorous scrubbing can burnish or remove the matte finish. Fine for low-touch walls.",
    moistureSuitability: "Not recommended for bathrooms or kitchens — matte finishes absorb moisture and stain more easily than sheen finishes.",
    installationNotes: "2 coats over a primer coat; touch-dry in a few hours, full cure in about a week. Straightforward roller/brush application.",
    removalNotes: "Can be painted over directly if the existing surface is sound; full removal only needed if the surface is damaged, via scraping/sanding.",
    avgCostPerSqftMinInr: 12,
    avgCostPerSqftMaxInr: 25,
    advantages: ["Widest colour range", "Cheapest wall-paint option", "Easy to repaint over"],
    limitations: ["Not washable", "Shows marks/scuffs more than sheen finishes", "Not moisture-suitable"],
    durabilityYearsApprox: 6,
    maintenanceLevel: "medium",
    moistureLevel: "poor",
    costTier: "budget",
  },
  {
    slug: "paint_emulsion_sheen",
    category: "paint",
    subtype: "emulsion_sheen",
    name: "Interior Emulsion — Silk/Satin Sheen",
    description: "A step up from matte emulsion with a soft sheen, genuinely washable — the common choice for high-traffic living areas, hallways, and kids' rooms.",
    durability: "6-8 years, holds colour and finish better than matte under regular cleaning.",
    maintenance: "Washable with a damp cloth — handles fingerprints, food splashes, and everyday marks well.",
    moistureSuitability: "Reasonable for kitchens; still not ideal for a constantly-wet bathroom wall.",
    installationNotes: "Similar application to matte emulsion; sheen shows surface imperfections more, so wall prep matters more.",
    removalNotes: "Same as matte — repaintable directly if the surface is sound.",
    avgCostPerSqftMinInr: 15,
    avgCostPerSqftMaxInr: 30,
    advantages: ["Washable", "More stain-resistant than matte", "Good for high-traffic rooms"],
    limitations: ["Highlights wall imperfections more than matte", "Slightly higher cost"],
    durabilityYearsApprox: 7,
    maintenanceLevel: "low",
    moistureLevel: "fair",
    costTier: "budget",
  },
  {
    slug: "paint_enamel",
    category: "paint",
    subtype: "enamel",
    name: "Enamel / Semi-Gloss",
    description: "A hard, glossy, highly washable paint traditionally used on doors and trims, also used on walls in kitchens, bathrooms, and utility areas.",
    durability: "8-10+ years — the most durable common paint finish, resists chipping and moisture well.",
    maintenance: "Fully washable and scrub-resistant — the easiest finish to keep clean.",
    moistureSuitability: "Good — commonly used in kitchens and bathrooms specifically because of its water resistance.",
    installationNotes: "Needs a smoother, well-prepped surface than emulsion — imperfections show clearly under gloss. Longer dry/cure time between coats.",
    removalNotes: "Harder to paint over directly — a glossy surface usually needs light sanding first for a new coat to adhere.",
    avgCostPerSqftMinInr: 18,
    avgCostPerSqftMaxInr: 35,
    advantages: ["Most washable/durable common paint", "Best moisture resistance among paints", "Classic look for trims and wet areas"],
    limitations: ["Highlights every surface flaw", "Harder to repaint over", "Glossy look isn't to everyone's taste for full walls"],
    durabilityYearsApprox: 9,
    maintenanceLevel: "low",
    moistureLevel: "good",
    costTier: "mid",
  },
  {
    slug: "paint_premium_textured",
    category: "paint",
    subtype: "premium_textured",
    name: "Premium Textured Emulsion",
    description: "Higher-end emulsion lines (the category Asian Paints Royale/Berger Silk-type products sit in) with finer pigment, better coverage, and sometimes a subtle texture or pearl finish.",
    durability: "8-10 years, better colour retention and stain resistance than standard emulsion.",
    maintenance: "Washable, often marketed as stain-resistant/anti-bacterial.",
    moistureSuitability: "Better than standard emulsion but still not a wet-area (bathroom) paint.",
    installationNotes: "Same application method as standard emulsion; often needs fewer coats for full opacity due to richer pigment.",
    removalNotes: "Repaintable directly if the surface is sound, same as standard emulsion.",
    avgCostPerSqftMinInr: 30,
    avgCostPerSqftMaxInr: 55,
    advantages: ["Richer colour depth", "Better durability than standard emulsion", "Often includes stain-resistant additives"],
    limitations: ["Meaningfully more expensive", "Still not a true wet-area finish"],
    durabilityYearsApprox: 9,
    maintenanceLevel: "low",
    moistureLevel: "fair",
    costTier: "premium",
  },

  // ── Wallpaper ──────────────────────────────────────────────────────────
  {
    slug: "wallpaper_vinyl",
    category: "wallpaper",
    subtype: "vinyl",
    name: "Vinyl / PVC Wallpaper",
    description: "The most common wallpaper type in India — a printed vinyl surface, widely available in a huge range of patterns at accessible prices.",
    durability: "5-8 years — vinyl resists tearing and fading reasonably well.",
    maintenance: "Wipeable with a damp cloth; the vinyl surface handles light moisture and dusting well.",
    moistureSuitability: "Good relative to other wallpapers — vinyl itself is water-resistant, though the wall behind it and adhesive still need to stay dry.",
    installationNotes: "Pasted directly to a smoothed, primed wall; pattern repeat and seam alignment matter — professional installation recommended for a clean result.",
    removalNotes: "Can be peeled, though the backing paper sometimes stays and needs soaking/scraping — expect some wall-surface touch-up after removal.",
    avgCostPerSqftMinInr: 35,
    avgCostPerSqftMaxInr: 90,
    advantages: ["Huge pattern/colour selection", "Reasonably durable and wipeable", "Widely available"],
    limitations: ["Removal can damage the wall surface underneath", "Needs a smooth wall to look good", "Seams can show on a poor install"],
    durabilityYearsApprox: 6.5,
    maintenanceLevel: "low",
    moistureLevel: "good",
    costTier: "budget",
  },
  {
    slug: "wallpaper_non_woven",
    category: "wallpaper",
    subtype: "non_woven",
    name: "Non-Woven Wallpaper",
    description: "A breathable fabric-fibre-based wallpaper — pastes to the wall rather than the paper itself, making install and removal noticeably cleaner than vinyl.",
    durability: "6-10 years, resists tearing better than paper-backed types.",
    maintenance: "Light wiping only for most non-woven papers (check the specific product — not all are washable).",
    moistureSuitability: "Breathable, which actually helps avoid trapped moisture/mould behind it — but still not a wet-area material.",
    installationNotes: "Paste-the-wall (not paste-the-paper) application — generally easier and less messy to install than vinyl.",
    removalNotes: "The easiest wallpaper type to remove — typically peels off dry in full strips without damaging the wall.",
    avgCostPerSqftMinInr: 45,
    avgCostPerSqftMaxInr: 120,
    advantages: ["Cleanest install and removal of common wallpaper types", "Breathable", "Good dimensional stability (less stretching/bubbling)"],
    limitations: ["More expensive than vinyl", "Less washable than vinyl for most product lines"],
    durabilityYearsApprox: 8,
    maintenanceLevel: "medium",
    moistureLevel: "fair",
    costTier: "mid",
  },
  {
    slug: "wallpaper_textile",
    category: "wallpaper",
    subtype: "textile",
    name: "Textile / Fabric-Backed Wallpaper",
    description: "A premium wallpaper with a real fabric face (silk, grasscloth, linen-look) bonded to a paper or non-woven backing — used for a luxury, textured accent wall.",
    durability: "Variable by fabric — generally more delicate than vinyl, sensitive to sunlight fading and staining.",
    maintenance: "Usually dust/vacuum only — most fabric wallpapers cannot be wiped wet.",
    moistureSuitability: "Poor — not suitable for humid rooms or anywhere near water.",
    installationNotes: "Needs a professional installer experienced with fabric papers — unforgiving of wall imperfections and installation mistakes.",
    removalNotes: "Can be difficult to remove cleanly; often requires steaming and can still damage the wall surface.",
    avgCostPerSqftMinInr: 100,
    avgCostPerSqftMaxInr: 300,
    advantages: ["Distinctive luxury texture no paint or vinyl can replicate", "Strong visual statement for an accent wall"],
    limitations: ["Expensive", "Delicate — stains and fades easily", "Not moisture-tolerant", "Harder to install and remove"],
    durabilityYearsApprox: 4,
    maintenanceLevel: "high",
    moistureLevel: "poor",
    costTier: "premium",
  },
  {
    slug: "wallpaper_peel_stick",
    category: "wallpaper",
    subtype: "peel_stick",
    name: "Peel-and-Stick Wallpaper",
    description: "Self-adhesive wallpaper designed for easy DIY application and removal — popular for renters or anyone wanting a temporary, low-commitment change.",
    durability: "2-5 years — shorter-lived and more prone to edges lifting over time than pasted wallpaper.",
    maintenance: "Light wiping; quality varies significantly by brand.",
    moistureSuitability: "Generally poor — adhesive can fail in humid conditions.",
    installationNotes: "No paste or professional needed — genuinely DIY-friendly, applied directly from the backing.",
    removalNotes: "The whole point of this category — designed to peel off cleanly without damaging paint or plaster underneath (though cheaper products can still leave residue).",
    avgCostPerSqftMinInr: 25,
    avgCostPerSqftMaxInr: 70,
    advantages: ["No professional installation needed", "Fully reversible — ideal for rentals", "Fast to apply"],
    limitations: ["Shorter lifespan", "Edges can lift over time, especially in humidity", "Quality/adhesion varies a lot by brand"],
    durabilityYearsApprox: 3.5,
    maintenanceLevel: "medium",
    moistureLevel: "poor",
    costTier: "budget",
  },

  // ── Wall Texture ───────────────────────────────────────────────────────
  {
    slug: "texture_roller_stencil",
    category: "wall_texture",
    subtype: "roller_stencil",
    name: "Textured Paint (Roller/Stencil Finish)",
    description: "A textured effect created with specialised rollers, combs, or stencils over a base coat — the most accessible way to get a textured wall without a plaster specialist.",
    durability: "5-8 years, similar to the base paint used.",
    maintenance: "Similar to the underlying paint type — texture can trap more dust than a flat wall, needing occasional dusting.",
    moistureSuitability: "Depends on the base paint used underneath — can be paired with a moisture-resistant base for slightly better performance.",
    installationNotes: "Applied by a painter with texturing tools/stencils — more labour-intensive than flat paint but doesn't require a specialist plasterer.",
    removalNotes: "Can be skimmed over with plaster or sanded back if a flat finish is wanted later — more work than repainting a flat wall.",
    avgCostPerSqftMinInr: 40,
    avgCostPerSqftMaxInr: 90,
    advantages: ["More accessible than plaster-based textures", "Wide range of pattern options", "Good accent-wall option on a moderate budget"],
    limitations: ["Traps more dust than a flat wall", "Harder to touch up a small damaged area invisibly"],
    durabilityYearsApprox: 6.5,
    maintenanceLevel: "medium",
    moistureLevel: "fair",
    costTier: "mid",
  },
  {
    slug: "texture_pop_design",
    category: "wall_texture",
    subtype: "pop_design",
    name: "POP (Plaster of Paris) Design",
    description: "Moulded Plaster of Paris used to create raised decorative patterns or panels on a wall or ceiling — extremely common in Indian homes for feature walls and ceiling borders.",
    durability: "10+ years if not physically knocked or exposed to damp — POP itself is long-lasting but brittle.",
    maintenance: "Dusting only; POP is painted over (usually with emulsion) and maintained like that paint.",
    moistureSuitability: "Poor — POP absorbs moisture readily and can crumble or stain in damp conditions; strictly a dry-room material.",
    installationNotes: "Requires a skilled POP contractor — moulding, fixing, and finishing is a specialist trade, not a standard painter's job.",
    removalNotes: "Genuinely difficult to remove without damaging the wall/ceiling underneath — usually treated as a permanent feature.",
    avgCostPerSqftMinInr: 60,
    avgCostPerSqftMaxInr: 150,
    advantages: ["Distinctive 3D decorative detail paint/wallpaper can't achieve", "Very common, well-understood trade in India", "Long-lasting if kept dry"],
    limitations: ["Not moisture-tolerant at all", "Specialist labour required", "Effectively permanent — expensive to change your mind"],
    durabilityYearsApprox: 10,
    maintenanceLevel: "low",
    moistureLevel: "poor",
    costTier: "premium",
  },
  {
    slug: "texture_lime_plaster",
    category: "wall_texture",
    subtype: "lime_plaster",
    name: "Lime Plaster / Natural Stone-Effect Finish",
    description: "A traditional or modern lime-based plaster finish with a soft, natural, slightly irregular texture — used for an organic, premium, earthy wall look.",
    durability: "10-20+ years — genuinely long-lived and improves slightly with age, a traditional building material.",
    maintenance: "Low — occasional dusting; naturally resists mould better than synthetic finishes due to lime's breathability and alkalinity.",
    moistureSuitability: "Good — lime plaster is breathable and naturally moisture-regulating, historically used in humid climates.",
    installationNotes: "Applied by hand in layers by a skilled plasterer — a genuine craft trade, longer project timeline than paint.",
    removalNotes: "Very difficult and usually not attempted — typically treated as a permanent architectural finish.",
    avgCostPerSqftMinInr: 80,
    avgCostPerSqftMaxInr: 200,
    advantages: ["Naturally moisture-regulating and mould-resistant", "Distinctive premium organic texture", "Very long lifespan"],
    limitations: ["Expensive", "Requires specialist artisan labour", "Long lead time", "Effectively permanent"],
    durabilityYearsApprox: 15,
    maintenanceLevel: "low",
    moistureLevel: "good",
    costTier: "premium",
  },
  {
    slug: "texture_venetian_stucco",
    category: "wall_texture",
    subtype: "venetian_stucco",
    name: "Venetian Plaster / Polished Stucco",
    description: "A multi-layer polished plaster technique that produces a smooth, marble-like sheen — a high-end feature-wall finish.",
    durability: "10+ years, holds its polish well when properly sealed.",
    maintenance: "Low — the polished surface resists dust and can be gently wiped; periodic re-waxing/sealing keeps the sheen.",
    moistureSuitability: "Reasonable when properly sealed, though still not intended as a wet-area (shower) finish.",
    installationNotes: "A specialist multi-coat technique requiring a trained applicator — one of the more labour-intensive wall finishes available.",
    removalNotes: "Not practically removable — treated as a permanent feature; a wall would typically be re-plastered over rather than stripped.",
    avgCostPerSqftMinInr: 120,
    avgCostPerSqftMaxInr: 350,
    advantages: ["High-end, distinctive marble-like appearance", "Long-lasting when sealed", "Low ongoing maintenance"],
    limitations: ["One of the most expensive wall finishes", "Requires a specialist applicator", "Effectively permanent"],
    durabilityYearsApprox: 12,
    maintenanceLevel: "low",
    moistureLevel: "fair",
    costTier: "premium",
  },

  // ── Wall Panel ─────────────────────────────────────────────────────────
  {
    slug: "panel_pvc",
    category: "wall_panel",
    subtype: "pvc",
    name: "PVC Wall Panels",
    description: "Lightweight, moisture-resistant plastic panels, often printed with a wood, stone, or 3D-textured finish — a budget-friendly way to clad a wall quickly.",
    durability: "8-12 years — PVC itself doesn't rot or warp, though the printed surface layer can fade in direct sun over time.",
    maintenance: "Very low — wipeable, doesn't need repainting.",
    moistureSuitability: "Very good — PVC is genuinely water-resistant, a common choice for bathroom or kitchen accent walls.",
    installationNotes: "Panels click/interlock or are adhesive/screw-fixed onto a frame or directly to a flat wall — one of the faster wall treatments to install.",
    removalNotes: "Straightforward to unscrew or pry off; the wall underneath may need patching depending on the fixing method used.",
    avgCostPerSqftMinInr: 45,
    avgCostPerSqftMaxInr: 110,
    advantages: ["Excellent moisture resistance", "Fast installation", "Low maintenance", "Budget-friendly for a paneled look"],
    limitations: ["Printed surface can look less premium up close than real materials", "Can fade in strong direct sunlight"],
    durabilityYearsApprox: 10,
    maintenanceLevel: "low",
    moistureLevel: "excellent",
    costTier: "budget",
  },
  {
    slug: "panel_wpc",
    category: "wall_panel",
    subtype: "wpc",
    name: "WPC (Wood-Plastic Composite) Panels",
    description: "A composite of wood fibre and plastic that looks and feels closer to real wood than PVC, while keeping much of PVC's moisture resistance.",
    durability: "10-15 years, more resistant to warping than real wood in humid conditions.",
    maintenance: "Low — occasional wiping, no refinishing needed.",
    moistureSuitability: "Good — significantly better than real wood veneer, though not as fully waterproof as pure PVC.",
    installationNotes: "Similar fixing methods to PVC panels (click-fit or fixed to a frame); slightly heavier to handle.",
    removalNotes: "Similar to PVC — unscrew/unclip; wall touch-up may be needed after removal.",
    avgCostPerSqftMinInr: 70,
    avgCostPerSqftMaxInr: 160,
    advantages: ["More realistic wood-like look than PVC", "Good moisture resistance for a wood-look product", "Doesn't need refinishing like real wood"],
    limitations: ["More expensive than PVC", "Still not as water-resistant as pure PVC"],
    durabilityYearsApprox: 12,
    maintenanceLevel: "low",
    moistureLevel: "good",
    costTier: "mid",
  },
  {
    slug: "panel_mdf_veneer",
    category: "wall_panel",
    subtype: "mdf_veneer",
    name: "MDF / Wood Veneer Panels",
    description: "Real wood veneer (or a high-quality laminate) bonded to an MDF board — the premium choice for a genuine wood-look feature wall.",
    durability: "10-15 years indoors in stable, dry conditions; genuinely sensitive to humidity swings.",
    maintenance: "Low to moderate — dust and dry-wipe; avoid wet cleaning, real veneer can be damaged by moisture.",
    moistureSuitability: "Poor — MDF swells and degrades with sustained moisture exposure; strictly a dry-room material.",
    installationNotes: "Fixed to a wall frame/batten system by a carpenter — a more involved, furniture-grade installation than PVC or WPC.",
    removalNotes: "Removable by a carpenter but labour-intensive; the frame system usually stays and may need patching if removed entirely.",
    avgCostPerSqftMinInr: 120,
    avgCostPerSqftMaxInr: 350,
    advantages: ["Genuine premium wood-grain appearance", "Warm, high-end feel real composites can't fully match"],
    limitations: ["Poor moisture tolerance", "Most expensive panel option", "Needs skilled carpentry to install well"],
    durabilityYearsApprox: 12,
    maintenanceLevel: "medium",
    moistureLevel: "poor",
    costTier: "premium",
  },
  {
    slug: "panel_3d_decorative",
    category: "wall_panel",
    subtype: "3d_decorative",
    name: "3D Decorative Panels",
    description: "Geometric or organic raised-relief panels (PVC, gypsum, or MDF based) used to create a sculptural, textured accent wall.",
    durability: "8-12 years depending on base material (PVC/gypsum variants covered separately above for moisture behaviour).",
    maintenance: "Low — the relief pattern can trap slightly more dust than a flat panel, benefiting from occasional dusting.",
    moistureSuitability: "Depends on base material — PVC-based 3D panels handle humidity well; gypsum-based ones do not.",
    installationNotes: "Tiled/interlocking panels fixed directly to a flat, prepared wall — moderately DIY-feasible for a skilled installer, though pattern alignment across panels matters.",
    removalNotes: "Similar to other panel types — unscrew/unclip, with possible wall patching needed afterward.",
    avgCostPerSqftMinInr: 55,
    avgCostPerSqftMaxInr: 180,
    advantages: ["Strong sculptural visual impact for an accent wall", "Good lighting/shadow play", "Range of base materials to match a budget"],
    limitations: ["Moisture tolerance varies a lot by base material — check the specific product", "Pattern alignment mistakes are visible"],
    durabilityYearsApprox: 10,
    maintenanceLevel: "low",
    moistureLevel: "fair",
    costTier: "mid",
  },
];

export function getMaterialTaxonomyEntry(slug: string): MaterialTaxonomyEntry | undefined {
  return MATERIAL_TAXONOMY.find((m) => m.slug === slug);
}

export function listMaterialTaxonomyByCategory(category: MaterialCategory): MaterialTaxonomyEntry[] {
  return MATERIAL_TAXONOMY.filter((m) => m.category === category);
}
