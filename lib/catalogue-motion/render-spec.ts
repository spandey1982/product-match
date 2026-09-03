/**
 * Shared output-format constants every clip renderer (Veo, pan-zoom) must
 * match exactly. compose.ts's concat filter does zero normalization — any
 * drift in dimensions/fps/pixel format between clips breaks concatenation
 * silently, so this is the single source of truth both renderers reference
 * rather than each hardcoding its own copy.
 */
export const MOTION_CLIP_WIDTH = 720;
export const MOTION_CLIP_HEIGHT = 1280;
export const MOTION_CLIP_FPS = 24;
