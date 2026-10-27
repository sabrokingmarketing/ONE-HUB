import type { Doc } from "../../convex/_generated/dataModel";
import { formatDateTime } from "@/lib/utils";

export function HistoryList({ items }: { items: Doc<"auditLogs">[] }) {
  if (!items.length) return <p className="text-sm text-zinc-500">No changes recorded yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
      {items.map((h) => (
        <li key={h._id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-white ring-2 ring-brand-400" />
          <div className="text-zinc-800">{h.summary}</div>
          <div className="text-xs text-zinc-400">{formatDateTime(h.at)}</div>
        </li>
      ))}
    </ol>
  );
}
