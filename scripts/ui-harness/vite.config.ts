import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^convex\/react$/, replacement: path.join(__dirname, "convex-react-mock.tsx") },
      { find: /^@convex-dev\/auth\/react$/, replacement: path.join(__dirname, "auth-mock.tsx") },
      { find: "virtual:pwa-register", replacement: path.join(__dirname, "auth-mock.tsx") },
      { find: "@", replacement: path.join(root, "src") },
    ],
  },
  server: { fs: { allow: [root] } },
});
