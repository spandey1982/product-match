"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TaskRowData {
  id: string;
  title: string;
  description: string;
  dependencies: string | null;
  sourceRef: string | null;
  status: string;
}

async function updateStatus(id: string, status: string) {
  const res = await fetch(`/api/admin/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update task");
}

export function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handle = (status: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateStatus(task.id, status);
        router.refresh();
      } catch {
        setError("Failed to update — try again.");
      }
    });
  };

  return (
    <Card className={task.status !== "open" ? "opacity-50" : undefined}>
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{task.description}</p>
          {task.dependencies && (
            <p className="text-xs text-amber-700 mt-2 leading-relaxed">
              <span className="font-medium">Depends on:</span> {task.dependencies}
            </p>
          )}
          {task.sourceRef && (
            <p className="text-[11px] text-gray-400 mt-2 font-mono truncate" title={task.sourceRef}>
              {task.sourceRef}
            </p>
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.status === "open" ? (
            <>
              <button
                onClick={() => handle("done")}
                disabled={isPending}
                title="Mark done"
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => handle("dismissed")}
                disabled={isPending}
                title="Dismiss"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <Badge variant={task.status === "done" ? "success" : "default"}>{task.status}</Badge>
              <button
                onClick={() => handle("open")}
                disabled={isPending}
                title="Reopen"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
