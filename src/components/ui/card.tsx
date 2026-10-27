import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft white surface. Pass `fill` to stretch to the row height so blocks in a row always match. */
export function Card({ className, fill, ...p }: React.HTMLAttributes<HTMLDivElement> & { fill?: boolean }) {
  return <div className={cn("rounded-2xl bg-white shadow-card", fill && "flex h-full flex-col", className)} {...p} />;
}
export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6 pt-6", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h3>
        {description && <p className="mt-1 text-[13px] text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...p} />;
}
