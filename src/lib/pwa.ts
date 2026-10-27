import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

/** Registers the service worker and offers a refresh when a new version is deployed. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      toast("A new version of ONE HUB is available", { duration: Infinity, action: { label: "Refresh", onClick: () => void update(true) } });
    },
  });
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
