import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { TaskRow } from "@/components/admin/TaskRow";

export const metadata = { title: "Task Backlog — Internal" };

/**
 * Internal-only backlog of deferred work, admin-gated same as every other
 * /admin/* dashboard (404 for non-admins, no hint it exists). Sourced from a
 * real 2026-09-04 codebase/docs audit (see scripts/seed-task-backlog.ts) —
 * every row traces to a real file/line or doc section, nothing fabricated.
 * Grouped into the four categories that answer "who can actually act on
 * this": ai_future (a future coding session), user_only (credentials/
 * business decisions/real data only a human has), needs_verification
 * (real-world testing before more code), blocked_external (waiting on a
 * third-party vendor). Status (open/done/dismissed) is editable inline via
 * TaskRow -> PATCH /api/admin/tasks/[id], so this stays a living list
 * instead of a stale snapshot.
 */

const CATEGORY_META: Record<string, { label: string; blurb: string }> = {
  ai_future: {
    label: "Future build — a coding session can do this",
    blurb: "Well-specified enough to hand to a future session. Some carry a noted dependency below.",
  },
  user_only: {
    label: "Only you can do this",
    blurb: "Credentials, business/legal decisions, vendor selection, or real data only the account owner has.",
  },
  needs_verification: {
    label: "Needs verification first",
    blurb: "Needs real-world testing or evaluation before more code should be written.",
  },
  blocked_external: {
    label: "Blocked on a third party",
    blurb: "Waiting on a vendor/API capability neither of us controls.",
  },
};

const CATEGORY_ORDER = ["ai_future", "user_only", "needs_verification", "blocked_external"];

async function loadTasks() {
  try {
    return await db.taskItem.findMany({ orderBy: [{ status: "asc" }, { createdAt: "asc" }] });
  } catch (err) {
    console.error("[admin/tasks] failed to load:", err);
    return null;
  }
}

export default async function AdminTasksPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const tasks = await loadTasks();

  if (!tasks) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900">Task Backlog</h1>
        <p className="mt-4 text-sm text-gray-500">
          No data yet. Run <code className="mx-1 px-1 bg-gray-100 rounded">npx tsx scripts/seed-task-backlog.ts</code> to populate it.
        </p>
      </div>
    );
  }

  const openCount = tasks.filter((t) => t.status === "open").length;
  const firstNonEmptyCategory = CATEGORY_ORDER.find((c) => tasks.some((t) => t.category === c));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Task Backlog</h1>
        <p className="text-sm text-gray-500">
          {openCount} open of {tasks.length} total — sourced from a real codebase/docs audit, grouped by who can act on it.
        </p>
      </header>

      <div className="space-y-3">
        {CATEGORY_ORDER.map((category) => {
          const items = tasks.filter((t) => t.category === category);
          if (items.length === 0) return null;
          const meta = CATEGORY_META[category];
          const openCountInCategory = items.filter((t) => t.status === "open").length;

          return (
            // `name` groups every <details> into one exclusive accordion —
            // opening one closes the others — with zero client JS. Only the
            // first non-empty category starts open so the page isn't fully
            // collapsed on load.
            <details
              key={category}
              name="task-category"
              open={category === firstNonEmptyCategory}
              className="group rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 transition-colors">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    {meta.label}{" "}
                    <span className="text-gray-400 font-normal">
                      ({openCountInCategory} open{items.length !== openCountInCategory ? ` · ${items.length} total` : ""})
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{meta.blurb}</p>
                </div>
                <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-50">
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
