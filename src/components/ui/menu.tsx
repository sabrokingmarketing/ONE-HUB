import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ className, align = "end", ...p }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn("z-50 min-w-48 rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-stone-200 animate-in", className)} {...p} />
    </M.Portal>
  );
}
export function MenuItem({ className, danger, ...p }: M.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <M.Item
      className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-stone-100 [&_svg]:size-4 [&_svg]:text-stone-400", danger ? "text-red-600 [&_svg]:text-red-500" : "text-stone-700", className)}
      {...p}
    />
  );
}
export function MenuLabel({ className, ...p }: M.DropdownMenuLabelProps) {
  return <M.Label className={cn("px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-stone-400 uppercase", className)} {...p} />;
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-stone-100" />;
