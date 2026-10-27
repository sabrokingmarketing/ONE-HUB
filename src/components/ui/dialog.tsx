import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, title, description, children, footer, size = "md" }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] animate-in" />
        <D.Content className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white shadow-pop animate-in sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl", w)}>
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
            <div>
              <D.Title className="text-base font-semibold text-stone-900">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-sm text-stone-500">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
            </div>
            <D.Close className="-mr-2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Slide-over panel from the right (full screen on mobile). */
export function Sheet({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-in" />
        <D.Content className={cn("fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-pop animate-slide sm:rounded-l-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div>
              <D.Title className="text-base font-semibold text-stone-900">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-sm text-stone-500">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
            </div>
            <D.Close className="-mr-2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", danger, onConfirm, loading, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; loading?: boolean; children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="sm"
      footer={<>
        <button className="h-10 rounded-xl px-4 text-sm font-medium text-stone-600 hover:bg-stone-100" onClick={() => onOpenChange(false)}>Cancel</button>
        <button disabled={loading} className={cn("h-10 rounded-xl px-4 text-sm font-medium text-white disabled:opacity-50", danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-500 hover:bg-brand-600")} onClick={onConfirm}>{confirmLabel}</button>
      </>}>
      {description && <div className="text-sm text-stone-600">{description}</div>}
      {children}
    </Dialog>
  );
}
