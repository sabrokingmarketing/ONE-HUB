/** Minimal monochrome platform glyphs (lucide no longer ships brand marks). */
type P = { className?: string };
export const Facebook = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14.2 2C11.1 2 10.4 4.3 10.4 5.8v2.7H8.5V12h1.9v10H14V12h2.6l.4-3.5z" /></svg>
);
export const Instagram = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
);
export const Linkedin = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 9h3v12H3zM9 9h2.9v1.7h.1c.4-.8 1.4-1.9 3.1-1.9 3.3 0 3.9 2.2 3.9 5V21h-3v-6.4c0-1.5 0-3.5-2.1-3.5S11 12.8 11 14.5V21H9z" /></svg>
);
