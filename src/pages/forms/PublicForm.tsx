import { useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Lock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { errorMessage } from "@/lib/utils";
import { FormRenderer, type Answers } from "./FormRenderer";

/** Public, unauthenticated lead form at /f/:slug. Exposes only the form definition. */
export default function PublicForm() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const form = useQuery(api.leadForms.publicGet, { slug });
  const submit = useMutation(api.leadForms.submit);
  const [answers, setAnswers] = useState<Answers>({});
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState("");
  const started = useRef(Date.now());
  const accent = form?.accentColor ?? "#F26B1D";
  const style = useMemo(() => ({ "--accent": accent }) as React.CSSProperties, [accent]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const r = await submit({ slug, answers, honeypot: honeypot || undefined, elapsedMs: Date.now() - started.current });
      if (r.successUrl) { window.location.href = r.successUrl; return; }
      setThanks(r.thankYouMessage);
      setState("done");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className={embed ? "bg-transparent p-2" : "min-h-dvh bg-canvas px-4 py-10 sm:py-16"} style={style}>
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="h-1.5" style={{ background: accent }} />
        {children}
      </div>
      {!embed && <p className="mt-6 text-center text-xs text-zinc-400">ONE Property Holdings · Your information is handled in line with POPIA.</p>}
    </div>
  );

  if (form === undefined) return shell(<div className="h-80 animate-pulse bg-zinc-50" />);
  if (form === null) return shell(<div className="p-10 text-center"><h1 className="text-lg font-semibold">Form not found</h1><p className="mt-1 text-sm text-zinc-500">This link may be incorrect or the form was removed.</p></div>);
  if (!form.active) return shell(<div className="p-10 text-center"><Lock className="mx-auto mb-3 size-6 text-zinc-300" /><h1 className="text-lg font-semibold">{form.title}</h1><p className="mt-1 text-sm text-zinc-500">This form isn't accepting submissions right now.</p></div>);
  if (state === "done") return shell(<div className="p-10 text-center"><CheckCircle2 className="mx-auto mb-3 size-10" style={{ color: accent }} /><h1 className="text-lg font-semibold">Submitted</h1><p className="mt-2 text-sm whitespace-pre-wrap text-zinc-600">{thanks}</p></div>);

  return shell(
    <form onSubmit={onSubmit} className="p-6 sm:p-8" noValidate={false}>
      <h1 className="text-xl font-semibold tracking-tight">{form.title}</h1>
      {form.description && <p className="mt-1.5 text-sm whitespace-pre-wrap text-zinc-500">{form.description}</p>}
      <div className="mt-6"><FormRenderer fields={form.fields} answers={answers} onChange={setAnswers} accent={accent} disabled={state === "sending"} /></div>
      {/* Honeypot: hidden from humans, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="mt-6 h-11 w-full rounded-xl text-sm font-semibold text-white transition disabled:opacity-60" style={{ background: accent }}>
        {state === "sending" ? "Submitting…" : "Submit"}
      </button>
    </form>,
  );
}
