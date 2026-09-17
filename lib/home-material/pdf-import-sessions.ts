/**
 * In-memory cache of open PdfImportSessions, keyed by HmCatalogueImport.id
 * (2026-09-16). Lets the catalogue-import API process one PDF page per
 * request (POST .../process-next) instead of the whole file synchronously
 * in one blocking call — so the admin sees live per-page progress and can
 * stop early instead of sitting on an unknown-length wait, per real user
 * feedback after a genuine multi-minute blind hang on a real supplier PDF.
 *
 * Cached on `globalThis`, not a plain module-level `const`, using the exact
 * same pattern as lib/db.ts's Prisma client — found necessary the hard way
 * (2026-09-17): a plain top-level `Map` here worked fine right after this
 * was first written, then started failing every session lookup ("session
 * no longer available") as soon as this file and its importers (the two
 * route handlers) were edited independently across several rounds in the
 * same running `next dev` process. Turbopack's incremental dev
 * compilation can give two route files that both `import` this module
 * two DIFFERENT instances of it if they were compiled at different
 * points in the session — a real HMR footgun, not a one-off. `globalThis`
 * caching sidesteps it the same way lib/db.ts already had to for the
 * Prisma client, guaranteeing one true singleton Map for the life of the
 * Node process regardless of which route last got recompiled.
 *
 * This app runs as one long-lived Node process (not serverless), so state
 * here survives across the sequence of requests one import's processing
 * makes.
 *
 * The raw PDF is deliberately NOT persisted anywhere (tried Cloudinary
 * first — real supplier PDFs routinely exceed this account's 10MB
 * raw-upload cap, and upload_large's chunking only chunks the transport,
 * not the account's asset-size limit), so if an entry is missing (server
 * restarted mid-import, or evicted by the idle sweep below) there's no
 * way to resume — process-next reports a clear "re-upload" error instead.
 * Pages already extracted before that point stay valid, reviewable rows.
 */
import { openPdfImportSession, type PdfImportSession } from "@/lib/home-material/pdf-import";

interface CacheEntry {
  session: PdfImportSession;
  lastUsedAt: number;
}

const globalForHmPdfSessions = globalThis as unknown as {
  hmPdfImportSessions: Map<string, CacheEntry> | undefined;
};

const sessions = globalForHmPdfSessions.hmPdfImportSessions ?? new Map<string, CacheEntry>();
if (process.env.NODE_ENV !== "production") globalForHmPdfSessions.hmPdfImportSessions = sessions;

const IDLE_EVICT_MS = 30 * 60 * 1000; // an abandoned import's session is worth little after 30 idle minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;
function ensureSweepRunning() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [importId, entry] of sessions) {
      if (now - entry.lastUsedAt > IDLE_EVICT_MS) {
        entry.session.destroy().catch(() => {});
        sessions.delete(importId);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

export function cacheSession(importId: string, session: PdfImportSession): void {
  ensureSweepRunning();
  sessions.set(importId, { session, lastUsedAt: Date.now() });
}

export function getActiveSession(importId: string): PdfImportSession | null {
  const entry = sessions.get(importId);
  if (!entry) return null;
  entry.lastUsedAt = Date.now();
  return entry.session;
}

export async function closeSession(importId: string): Promise<void> {
  const entry = sessions.get(importId);
  if (!entry) return;
  sessions.delete(importId);
  await entry.session.destroy().catch(() => {});
}

export { openPdfImportSession };
