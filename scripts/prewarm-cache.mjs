// Run after deployment: node scripts/prewarm-cache.mjs
// Requests every image at the sizes Next.js will serve so Vercel caches them.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE_URL = process.argv[2] ?? "https://outside-the-box.vercel.app";

const boxes = JSON.parse(readFileSync(join(ROOT, "data", "boxes.json"), "utf-8"));
const images = boxes.flatMap(b => b.images ?? []).filter(Boolean);

// Sizes Next.js requests for gallery (matches `sizes` prop in StreetView3D)
const widths = [256, 384, 640, 750];

console.log(`Pre-warming ${images.length * widths.length} image variants on ${BASE_URL}...`);

let ok = 0, fail = 0;
for (const src of images) {
  for (const w of widths) {
    const url = `${BASE_URL}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
    try {
      const res = await fetch(url);
      if (res.ok) { ok++; process.stdout.write("."); }
      else { fail++; process.stdout.write("x"); }
    } catch {
      fail++;
      process.stdout.write("x");
    }
  }
}

console.log(`\n✓ Done — ${ok} cached, ${fail} failed`);
