export function SetupRequired() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6 font-sans">
      <div className="max-w-lg rounded-2xl bg-white p-8 shadow-card ring-1 ring-stone-200">
        <div className="mb-1 text-xs font-semibold tracking-wider text-brand-600 uppercase">ONE HUB setup</div>
        <h1 className="text-xl font-semibold">Connect a Convex deployment</h1>
        <p className="mt-2 text-sm text-stone-600">
          <code className="rounded bg-stone-100 px-1">VITE_CONVEX_URL</code> is not set. Create a <strong>new, dedicated</strong> Convex project for ONE HUB by running{" "}
          <code className="rounded bg-stone-100 px-1">npx convex dev</code> — it writes the URL to <code className="rounded bg-stone-100 px-1">.env.local</code>. See <code className="rounded bg-stone-100 px-1">docs/SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}
