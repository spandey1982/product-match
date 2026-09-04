import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { HealthBreakdown } from "@/lib/seo/health-score";

export const metadata = { title: "SEO/GEO Health — Internal" };

/**
 * Internal-only GEO/AEO/SEO health-score dashboard (owners/admins). Admin-gated:
 * non-admins get a 404 (no hint it exists), same pattern as app/(dashboard)/admin/usage.
 * Reads seo_health_snapshots — one row per run of
 * /api/internal/seo-health-audit (see that route + lib/seo/health-score.ts).
 */

const SNAPSHOT_LIMIT = 30;

async function loadSnapshots() {
  try {
    const rows = await db.seoHealthSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: SNAPSHOT_LIMIT,
    });
    return rows;
  } catch (err) {
    console.error("[admin/seo-health] failed to load:", err);
    return null;
  }
}

function formatIST(date: Date): string {
  return `${date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })} IST`;
}

function delta(current: number, previous: number | undefined): string {
  if (previous === undefined) return "";
  const d = current - previous;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

export default async function AdminSeoHealthPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const snapshots = await loadSnapshots();

  if (!snapshots) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900">SEO/GEO Health</h1>
        <p className="mt-4 text-sm text-gray-500">
          No data yet. Run <code className="mx-1 px-1 bg-gray-100 rounded">npx tsx scripts/run-seo-health-audit.ts</code>
          locally, or trigger the daily audit job, to produce the first snapshot.
        </p>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900">SEO/GEO Health</h1>
        <p className="mt-4 text-sm text-gray-500">
          No snapshots recorded yet. Run <code className="mx-1 px-1 bg-gray-100 rounded">npx tsx scripts/run-seo-health-audit.ts</code>
          locally, or trigger <code className="mx-1 px-1 bg-gray-100 rounded">POST /api/internal/seo-health-audit</code> to produce one.
        </p>
      </div>
    );
  }

  const latest = snapshots[0];
  const previous = snapshots[1];
  const breakdown = JSON.parse(latest.breakdown) as HealthBreakdown;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">SEO/GEO Health</h1>
        <p className="text-sm text-gray-500">
          Last computed {formatIST(new Date(latest.createdAt))} · {snapshots.length} snapshot(s) on file
        </p>
      </header>

      {/* Overall score + deltas */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Overall score", value: `${latest.score}/100`, d: delta(latest.score, previous?.score) },
          { label: "Metadata", value: `${breakdown.tierA.metadataCompleteness.pct}%` },
          { label: "Images", value: `${breakdown.tierA.imageCompleteness.pct}%` },
          { label: "SKU", value: `${breakdown.tierA.skuCompleteness.pct}%` },
          { label: "Collections", value: `${breakdown.tierA.collectionHealth.pct}%` },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-lg font-semibold text-gray-900">
              {c.value}
              {c.d && <span className={`ml-2 text-xs font-medium ${c.d.startsWith("+") ? "text-emerald-600" : c.d.startsWith("-") ? "text-red-600" : "text-gray-400"}`}>{c.d}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* Live smoke test */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Live smoke test</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-sm text-gray-700">
          {breakdown.tierB.ran
            ? `${breakdown.tierB.pagesPassed}/${breakdown.tierB.pagesChecked} sampled pages passed (valid title + parseable JSON-LD).`
            : "Did not run — could not reach the app's public URL from the audit job."}
        </div>
      </section>

      {/* Findings */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Findings (what to fix next)</h2>
        <Table
          head={["Severity", "Subject", "Message"]}
          rows={breakdown.findings.map((f) => [f.severity, f.subject, f.message])}
        />
      </section>

      {/* Trend */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Trend (most recent {snapshots.length})</h2>
        <Table
          head={["When", "Score"]}
          rows={snapshots.map((s) => [formatIST(new Date(s.createdAt)), `${s.score}/100`])}
        />
      </section>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-6 text-center text-gray-400">
                No data yet.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-800 whitespace-nowrap max-w-md truncate" title={String(cell)}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
