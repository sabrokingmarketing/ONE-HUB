import { Logo } from "@/components/layout/Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <Logo />
        <div className="relative z-10 mt-auto max-w-md">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-400 uppercase">ONE Property Holdings</p>
          <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-tight">One platform.<br />Every connection.<br /><span className="text-brand-500">Complete control.</span></h2>
          <p className="mt-5 text-zinc-400">The internal operating system for our directors and administrators.</p>
        </div>
        <div className="pointer-events-none absolute -right-40 -bottom-40 size-[34rem] rounded-full border-[64px] border-brand-500/10" />
        <div className="pointer-events-none absolute -right-10 bottom-24 size-48 rounded-full border-[28px] border-brand-500/20" />
      </div>
      <div className="flex flex-col justify-center bg-canvas px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo dark /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
