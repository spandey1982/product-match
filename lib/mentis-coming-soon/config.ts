// Single place to configure the Mentis Coming Soon landing page (root "/").

/**
 * Logo asset. Drop the final file at this path (SVG or transparent PNG) and it
 * is used without being cropped or stretched (see the colour flag below). To switch format,
 * just change the extension here, e.g. "/mentis/logo.png".
 * Currently a temporary placeholder: replace public/mentis/logo.svg.
 */
export const MENTIS_LOGO_SRC = "/mentis/logo.svg";
export const MENTIS_LOGO_ALT = "Mentis";
/**
 * true: the logo is drawn as a single-colour silhouette in the General Text
 * colour (works for SVG and transparent PNG; multi-colour artwork becomes flat).
 * false: the logo is shown exactly as supplied, in its own colours.
 */
export const MENTIS_LOGO_FOLLOWS_GENERAL_TEXT = true;

/** Contact number shown at the bottom of the page until the service is live. */
export const MENTIS_CONTACT_PHONE_DISPLAY = "+91 8073 449 615";
export const MENTIS_CONTACT_PHONE_TEL = "+918073449615";

/**
 * Local-only brand-design tool (floating colour customiser).
 * On by default in development (`npm run dev`) and OFF in any production build,
 * so it is never shown on the deployed site. To preview it on a deployed or
 * staging build, set NEXT_PUBLIC_MENTIS_COLOUR_CUSTOMIZER=true there; to remove
 * it entirely, see components/mentis-coming-soon/colour-customizer/.
 */
export const ENABLE_MENTIS_COLOUR_CUSTOMIZER =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MENTIS_COLOUR_CUSTOMIZER === "true";
