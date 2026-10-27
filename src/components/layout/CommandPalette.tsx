import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import * as D from "@radix-ui/react-dialog";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const results = useQuery(api.search.global, open && dq.trim().length >= 2 ? { q: dq } : "skip");
  const flat = useMemo(() => (results ?? []).flatMap((g) => g.items), [results]);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [results]);
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const go = (href: string) => { onOpenChange(false); navigate(href); };
  const loading = dq.trim().length >= 2 && results === undefined;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] animate-in" />
        <D.Content
          className="fixed top-[10vh] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-zinc-200 animate-in"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && flat[active]) go(flat[active].href);
          }}
        >
          <D.Title className="sr-only">Search ONE HUB</D.Title>
          <D.Description className="sr-only">Search across records you have access to</D.Description>
          <div className="flex items-center gap-3 border-b border-zinc-100 px-4">
            {loading ? <Loader2 className="size-4 animate-spin text-zinc-400" /> : <Search className="size-4 text-zinc-400" />}
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brokers, employees, leads, documents…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400" />
            <kbd className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">Esc</kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {dq.trim().length < 2 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-400">Type at least 2 characters. Results only include records you're allowed to see.</p>
            ) : results && results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-400">No matches for “{dq}”.</p>
            ) : (
              (results ?? []).map((g) => (
                <div key={g.group} className="mb-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">{g.group}</div>
                  {g.items.map((it) => {
                    const idx = flat.indexOf(it);
                    return (
                      <button key={it.id} onMouseEnter={() => setActive(idx)} onClick={() => go(it.href)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", idx === active ? "bg-brand-50" : "hover:bg-zinc-50")}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-zinc-900">{it.title}</div>
                          {it.subtitle && <div className="truncate text-xs text-zinc-500">{it.subtitle}</div>}
                        </div>
                        {idx === active && <CornerDownLeft className="size-4 text-brand-500" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
