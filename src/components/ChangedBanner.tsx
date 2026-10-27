import { RefreshCw } from "lucide-react";

/** Shown inside an edit form when the live record changed after editing began. */
export function ChangedBanner({ by, onReload }: { by: string; onReload: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200">
      <RefreshCw className="size-4 shrink-0" />
      <span className="flex-1">{by} just updated this record. Saving now would be blocked to protect their changes.</span>
      <button className="font-medium underline" onClick={onReload}>Load latest</button>
    </div>
  );
}
