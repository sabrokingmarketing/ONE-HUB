import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Toaster } from "sonner";
import "./index.css";
import { App } from "./App";
import { SetupRequired } from "./pages/SetupRequired";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { registerServiceWorker } from "./lib/pwa";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (!url) {
  root.render(<StrictMode><SetupRequired /></StrictMode>);
} else {
  const convex = new ConvexReactClient(url);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton toastOptions={{ className: "!rounded-xl !font-sans" }} />
        </ConvexAuthProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
  // Public lead forms are often embedded on other sites; they don't need the app's service worker.
  if (!window.location.pathname.startsWith("/f/")) registerServiceWorker();
}
