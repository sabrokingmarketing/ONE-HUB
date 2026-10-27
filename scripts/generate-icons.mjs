#!/usr/bin/env node
/** Renders the temporary ONE HUB mark to the PNG icons the PWA manifest needs. */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { writeFileSync } from "node:fs";

const mark = (size, pad, rounded) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:#141416;border-radius:${rounded ? size * 0.22 : 0}px;display:grid;place-items:center">
<div style="width:${size * (1 - pad) * 0.5}px;height:${size * (1 - pad) * 0.5}px;border-radius:50%;border:${size * (1 - pad) * 0.11}px solid #F26B1D;box-sizing:border-box"></div></div></body></html>`;

const out = [
  ["public/pwa-192.png", 192, 0.1, false],
  ["public/pwa-512.png", 512, 0.1, false],
  ["public/pwa-512-maskable.png", 512, 0.3, false],
  ["public/apple-touch-icon.png", 180, 0.1, false],
  ["public/badge-72.png", 72, 0.1, false],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad, r] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(mark(size, pad, r));
  writeFileSync(file, await page.screenshot({ omitBackground: false }));
  console.log("wrote", file);
}
await browser.close();
