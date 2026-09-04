/**
 * Hand-authored, genuinely descriptive blurbs for each real category in
 * lib/catalog/taxonomy.ts's CATEGORIES list — the same list the /shop filter
 * bar uses, so every entry here maps to real, filterable inventory. Static
 * and human-reviewed on purpose: this is visible marketing-adjacent copy for
 * generative/search engines to read, not data — a small hand-maintained file
 * is easier to keep honest (no fabricated stats, no invented claims) than
 * DB rows nobody reviews. Missing an entry here just means that category's
 * "About" block doesn't render — never fall back to a fabricated blurb.
 */
export const CATEGORY_CONTENT: Record<string, string> = {
  Anarkali: "Anarkali suits are floor-length, flared silhouettes rooted in Mughal court fashion — worn across weddings, festive pujas, and formal receptions.",
  Blouse: "Blouses are the fitted top worn under a saree, cut and embellished to complement the drape — a staple for every festive or bridal saree look.",
  Clutch: "Clutches are compact, handheld evening bags — the finishing accessory for lehengas, sarees, and Anarkalis at weddings and parties.",
  Dupatta: "Dupattas are the long draped scarf worn with kurtas, lehengas, and Anarkali suits, often carrying the embroidery or border that defines the outfit.",
  "Fancy Dress": "Fancy dress covers festive and celebration-specific outfits for kids and adults — for functions, themed parties, and seasonal events.",
  Footwear: "Ethnic footwear — juttis, mojaris, and heels — is chosen to match an outfit's color and occasion, from everyday kurtas to bridal lehengas.",
  Handbag: "Handbags for ethnic wear range from structured day bags to embellished potli-style pouches for weddings and festive occasions.",
  Jewellery: "Ethnic jewellery — from statement bridal sets to everyday earrings — is chosen to coordinate with an outfit's neckline, color, and occasion.",
  Kurta: "Kurtas are a versatile, straight-cut ethnic top worn with palazzos, churidars, or jeans — equally suited to daily wear and festive occasions.",
  Lehenga: "Lehengas are a flared skirt, blouse, and dupatta ensemble — the standard choice for weddings, sangeet, and major festive occasions in Indian ethnic wear.",
  Palazzo: "Palazzos are wide-legged, flowing trousers commonly paired with kurtas or short kurtis for a comfortable, contemporary ethnic silhouette.",
  Saree: "Sarees are a single draped length of fabric — from Banarasi silk to georgette — spanning everyday wear through bridal and festive occasions.",
  Sharara: "Shararas are a flared, wide-legged trouser paired with a short kurta, traditionally worn for weddings and festive celebrations.",
  Shirt: "Shirts in ethnic wear cover fusion and Indo-western tops designed to pair with both ethnic bottoms and western wear.",
};
