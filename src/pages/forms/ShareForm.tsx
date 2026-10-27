import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Mail, MessageCircle, Code2, Download, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/share";
import { Textarea } from "@/components/ui/input";

export const formUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

export function ShareFormDialog({ open, onOpenChange, slug, title, active }: { open: boolean; onOpenChange: (o: boolean) => void; slug: string; title: string; active: boolean }) {
  const url = formUrl(slug);
  const qrRef = useRef<HTMLDivElement>(null);
  const embed = `<iframe src="${url}?embed=1" title="${title.replace(/"/g, "&quot;")}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug}-qr.png`;
    a.click();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Share “${title}”`} description={active ? "Anyone with this link can submit the form." : "This form is not active — the link will show a closed message until you activate it."} size="lg">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex gap-2"><input readOnly value={url} className="h-10 min-w-0 flex-1 rounded-xl bg-zinc-50 px-3 text-sm ring-1 ring-zinc-200" onFocus={(e) => e.target.select()} /><Button variant="secondary" onClick={() => void copy(url, "Link copied")}><Copy /> Copy</Button></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild><a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Please complete this form: ${url}`)}`}><Mail /> Email</a></Button>
            <Button variant="secondary" asChild><a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${url}`)}`} target="_blank" rel="noopener"><MessageCircle /> WhatsApp</a></Button>
            <Button variant="secondary" asChild><a href={url} target="_blank" rel="noopener"><ExternalLink /> Open</a></Button>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-zinc-700"><Code2 className="size-4" /> Embed code</div>
            <Textarea readOnly value={embed} className="min-h-20 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => void copy(embed, "Embed code copied")}><Copy /> Copy embed code</Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div ref={qrRef} className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200"><QRCodeCanvas value={url} size={168} level="M" marginSize={1} /></div>
          <Button variant="secondary" size="sm" onClick={downloadQr}><Download /> QR code</Button>
        </div>
      </div>
    </Dialog>
  );
}
