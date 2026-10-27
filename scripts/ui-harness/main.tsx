import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "@/index.css";
import { App } from "@/App";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <div className="fixed right-3 bottom-3 z-[100] rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950 shadow">UI harness · sample data</div>
    <App />
    <Toaster />
  </BrowserRouter>,
);
