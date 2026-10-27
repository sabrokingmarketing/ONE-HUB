/** Normalisation helpers used for duplicate detection & search. */
export const emailKey = (e?: string | null) => {
  const k = e?.trim().toLowerCase();
  return k ? k : undefined;
};

/** Normalise SA phone numbers: "+27 82 123 4567", "082-123-4567" → "27821234567". */
export const phoneKey = (p?: string | null) => {
  let d = (p ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.startsWith("0") && d.length === 10) d = "27" + d.slice(1);
  return d;
};

export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const searchText = (...parts: (string | undefined | null)[]) =>
  parts.filter(Boolean).join(" ").toLowerCase();

export const clean = (s?: string | null) => {
  const t = s?.trim();
  return t ? t : undefined;
};

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
