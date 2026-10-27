import { cn } from "@/lib/utils";
import logo from "@/assets/logo-one.webp";

/** Official ONE Property Holdings mark with the "HUB" product label. */
export function Logo({ dark, compact, className }: { dark?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <img src={logo} alt="ONE" width={75} height={32} className="h-8 w-auto" draggable={false} />
      {!compact && (
        <span className={cn("border-l pl-2.5 text-[13px] font-bold tracking-[0.22em]", dark ? "border-zinc-300 text-zinc-500" : "border-white/20 text-zinc-300")}>
          HUB
        </span>
      )}
    </span>
  );
}
