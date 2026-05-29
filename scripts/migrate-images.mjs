// Run: node scripts/migrate-images.mjs
// Uploads all /public/uploads/* to Supabase Storage bucket "boxes"
// and rewrites data/boxes.json with the new public URLs.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SUPABASE_URL = "https://ezrxpzsxprsxlebwysrz.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnhwenN4cHJzeGxlYnd5c3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkzMDUxNywiZXhwIjoyMDk1NTA2NTE3fQ.mPnTYf4tAdZovuYld8AvmJYX-AsZB6zJFIXMRCRLJc8";
const BUCKET = "boxes";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const uploadsDir = join(ROOT, "public", "uploads");
const files = readdirSync(uploadsDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp"));

console.log(`Uploading ${files.length} files to Supabase Storage bucket "${BUCKET}"...`);

const urlMap = {};

for (const file of files) {
  const filePath = join(uploadsDir, file);
  const fileBuffer = readFileSync(filePath);
  const contentType = "image/jpeg";

  const { error } = await supabase.storage.from(BUCKET).upload(file, fileBuffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error(`  ✗ ${file}: ${error.message}`);
  } else {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(file);
    urlMap[`/uploads/${file}`] = publicUrl;
    console.log(`  ✓ ${file}`);
  }
}

// Rewrite boxes.json
const boxesPath = join(ROOT, "data", "boxes.json");
const boxes = JSON.parse(readFileSync(boxesPath, "utf-8"));

for (const box of boxes) {
  if (box.images) {
    box.images = box.images.map(img => urlMap[img] ?? img);
  }
}

writeFileSync(boxesPath, JSON.stringify(boxes, null, 2));
console.log("\n✓ Updated data/boxes.json with Supabase URLs");
