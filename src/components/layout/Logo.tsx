import { cn } from "@/lib/utils";

/**
 * Temporary ONE HUB wordmark. Replace with the official ONE Property Holdings
 * logo asset once supplied (drop it in /public and swap this component).
 */
export function Logo({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className={cn("grid size-8 place-items-center rounded-[10px]", dark ? "bg-ink" : "bg-white/[0.07] ring-1 ring-white/10")}>
        <span className="size-3.5 rounded-full border-[3px] border-brand-500" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={cn("text-[15px] font-extrabold tracking-[0.12em]", dark ? "text-zinc-900" : "text-white")}>ONE</span>
          <span className={cn("ml-1 text-[15px] font-medium tracking-[0.08em]", dark ? "text-zinc-400" : "text-zinc-400")}>HUB</span>
        </span>
      )}
    </span>
  );
}
