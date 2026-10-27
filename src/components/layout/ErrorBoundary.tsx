import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-stone-200">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-500">An unexpected error occurred. Your data is safe — reload to continue.</p>
          <button onClick={() => location.reload()} className="mt-6 h-10 rounded-xl bg-brand-500 px-5 text-sm font-medium text-white hover:bg-brand-600">Reload ONE HUB</button>
        </div>
      </div>
    );
  }
}
