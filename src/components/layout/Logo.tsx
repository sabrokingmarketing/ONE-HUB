import { cn } from "@/lib/utils";
import logo from "@/assets/logo-one.webp";

/** Official ONE Property Holdings logo. */
export function Logo({ className }: { dark?: boolean; compact?: boolean; className?: string }) {
  return <img src={logo} alt="ONE" width={75} height={32} className={cn("h-8 w-auto select-none", className)} draggable={false} />;
}
