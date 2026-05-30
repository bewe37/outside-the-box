// Run: BLOB_READ_WRITE_TOKEN=... node scripts/migrate-images.mjs
// Uploads all /public/uploads/* to Vercel Blob and rewrites data/boxes.json.

import { put } from "@vercel/blob";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const uploadsDir = join(ROOT, "public", "uploads");
const files = readdirSync(uploadsDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

console.log(`Uploading ${files.length} files to Vercel Blob...`);

const urlMap = {};

for (const file of files) {
  const fileBuffer = readFileSync(join(uploadsDir, file));
  const blob = await put(`boxes/${file}`, fileBuffer, {
    access: "public",
    contentType: "image/jpeg",
  });
  urlMap[`/uploads/${file}`] = blob.url;
  console.log(`  ✓ ${file} → ${blob.url}`);
}

// Rewrite boxes.json with new Blob URLs
const boxesPath = join(ROOT, "data", "boxes.json");
const boxes = JSON.parse(readFileSync(boxesPath, "utf-8"));

for (const box of boxes) {
  if (box.images) {
    box.images = box.images.map(img => {
      // Already a Blob URL — skip
      if (img.includes("blob.vercel-storage.com")) return img;
      // Map old Supabase URL back to filename
      const filename = img.split("/").pop();
      return urlMap[`/uploads/${filename}`] ?? urlMap[img] ?? img;
    });
  }
}

writeFileSync(boxesPath, JSON.stringify(boxes, null, 2));
console.log("\n✓ Updated data/boxes.json with Vercel Blob URLs");
