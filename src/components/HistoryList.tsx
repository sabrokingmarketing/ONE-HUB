import type { Doc } from "../../convex/_generated/dataModel";
import { formatDateTime } from "@/lib/utils";

export function HistoryList({ items }: { items: Doc<"auditLogs">[] }) {
  if (!items.length) return <p className="text-sm text-stone-500">No changes recorded yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-stone-200 pl-5">
      {items.map((h) => (
        <li key={h._id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-white ring-2 ring-brand-400" />
          <div className="text-stone-800">{h.summary}</div>
          <div className="text-xs text-stone-400">{formatDateTime(h.at)}</div>
        </li>
      ))}
    </ol>
  );
}
