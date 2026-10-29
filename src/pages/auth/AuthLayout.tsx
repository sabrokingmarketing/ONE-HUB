import { Logo } from "@/components/layout/Logo";
import photo from "@/assets/auth-mall.webp";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas p-0 sm:p-4 lg:p-6">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] overflow-hidden bg-white sm:min-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:shadow-pop lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-2">
        {/* Form side */}
        <div className="flex flex-col px-6 py-8 sm:px-12 sm:py-10 lg:px-16 xl:px-24">
          <Logo className="h-12 self-center sm:h-14" />

          <div className="flex flex-1 items-center py-12">
            <div className="mx-auto w-full max-w-sm animate-in">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>}
              <div className="mt-9">{children}</div>
            </div>
          </div>

          <footer className="flex items-center justify-between text-xs text-zinc-400">
            <span>© {new Date().getFullYear()} ONE Property Holdings</span>
            <span>Invite only</span>
          </footer>
        </div>

        {/* Photo side */}
        <div className="relative hidden p-3 lg:block">
          <div className="relative size-full overflow-hidden rounded-2xl">
            <img src={photo} alt="" aria-hidden draggable={false} className="absolute inset-0 size-full object-cover object-[30%_center] select-none" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 via-40% to-transparent to-75%" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-12">
              <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white uppercase ring-1 ring-white/25 backdrop-blur-md">ONE Property Holdings</p>
              <h2 className="mt-4 text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
                One platform.
                <br />
                Every connection.
                <br />
                <span className="text-brand-500">Complete control.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm text-white/70">The internal operating system for our directors and administrators.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
