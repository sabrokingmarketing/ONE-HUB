import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConvexError } from "convex/values";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable message from any Convex / network error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const d = e.data as unknown;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "message" in d) return String((d as { message: unknown }).message);
  }
  if (e instanceof Error) {
    if (/network|fetch/i.test(e.message)) return "Connection problem — check your internet and try again.";
    const m = e.message.match(/Uncaught (?:ConvexError|Error): ([^\n]+)/);
    return m ? m[1] : "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export function errorCode(e: unknown): string | undefined {
  if (e instanceof ConvexError && e.data && typeof e.data === "object" && "code" in e.data) return String((e.data as { code: unknown }).code);
}

export const TZ = "Africa/Johannesburg";

export function formatDate(ms: number | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: TZ, ...opts }).format(new Date(ms));
}
export const formatDateTime = (ms?: number) => formatDate(ms, { dateStyle: "medium", timeStyle: "short" });
export const formatTime = (ms?: number) => formatDate(ms, { timeStyle: "short" });

export function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(ms);
}

export function initials(name?: string) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function downloadFile(name: string, content: string | Blob, type = "text/csv;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convert "YYYY-MM-DDTHH:mm" in Africa/Johannesburg (UTC+2, no DST) to epoch ms and back. */
export function sastInputToMs(v: string) {
  return new Date(`${v}:00+02:00`).getTime();
}
export function msToSastInput(ms: number) {
  return new Date(ms + 2 * 3600_000).toISOString().slice(0, 16);
}
