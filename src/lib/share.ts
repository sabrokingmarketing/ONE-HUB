import { toast } from "sonner";
import { downloadFile } from "./utils";

export interface ContactCard { fullName: string; company?: string; position?: string; email?: string; mobile?: string; office?: string; address?: string; website?: string }

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\;").replace(/\n/g, "\\n");

export function toVCard(c: ContactCard) {
  const [first, ...rest] = c.fullName.split(" ");
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:${esc(rest.join(" "))};${esc(first)};;;`, `FN:${esc(c.fullName)}`,
    c.company && `ORG:${esc(c.company)}`, c.position && `TITLE:${esc(c.position)}`,
    c.email && `EMAIL;TYPE=WORK:${esc(c.email)}`, c.mobile && `TEL;TYPE=CELL:${esc(c.mobile)}`, c.office && `TEL;TYPE=WORK:${esc(c.office)}`,
    c.address && `ADR;TYPE=WORK:;;${esc(c.address)};;;;`, c.website && `URL:${esc(c.website)}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function contactText(c: ContactCard) {
  return [c.fullName, [c.position, c.company].filter(Boolean).join(", "), c.email && `Email: ${c.email}`, c.mobile && `Mobile: ${c.mobile}`, c.office && `Office: ${c.office}`, c.address && `Address: ${c.address}`, c.website].filter(Boolean).join("\n");
}

export async function copy(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what);
  } catch {
    toast.error("Couldn't access the clipboard");
  }
}

export function downloadVCard(c: ContactCard) {
  downloadFile(`${c.fullName.replace(/[^\w ]/g, "").trim() || "contact"}.vcf`, toVCard(c), "text/vcard;charset=utf-8");
}

export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export async function nativeShare(c: ContactCard) {
  const file = new File([toVCard(c)], `${c.fullName}.vcf`, { type: "text/vcard" });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: c.fullName, text: contactText(c) });
    else if (navigator.share) await navigator.share({ title: c.fullName, text: contactText(c) });
    else await copy(contactText(c), "Contact details copied");
  } catch { /* user cancelled */ }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n");
}
