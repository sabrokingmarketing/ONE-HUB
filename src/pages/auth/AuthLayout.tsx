import { Logo } from "@/components/layout/Logo";
import architecture from "@/assets/auth-architecture.webp";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink text-white">
      {/* Architectural photo, tinted with the brand ink and a soft orange glow so the white card and copy stay legible. */}
      <img src={architecture} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 -z-20 size-full object-cover select-none" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-ink/85 via-ink/70 to-ink/45" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_85%_110%,rgb(247_147_30/0.28),transparent_70%)]" />

      <header className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8 lg:px-16">
        <Logo className="h-9 sm:h-10" />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur">Invite only</span>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20 lg:px-16">
        <section className="w-full max-w-md animate-in rounded-2xl bg-white p-7 text-zinc-900 shadow-pop sm:p-9">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </section>

        <div className="hidden lg:block">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-400 uppercase">ONE Property Holdings</p>
          <h2 className="mt-5 text-5xl leading-[1.08] font-semibold tracking-tight xl:text-6xl">
            One platform.
            <br />
            <span className="text-white/70">Every connection.</span>
            <br />
            <span className="text-brand-500">Complete control.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base text-white/60">The internal operating system for our directors and administrators.</p>
        </div>
      </main>

      <footer className="px-6 pb-6 text-xs text-white/40 sm:px-10 lg:px-16">© {new Date().getFullYear()} ONE Property Holdings</footer>
    </div>
  );
}
