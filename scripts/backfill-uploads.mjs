// One-time backfill: resize every image in public/uploads to MAX_EDGE @ q80 JPEG.
// Originals are copied to public/uploads-original-backup first. Filenames are
// preserved (.jpg extension) so existing references in data/boxes.json keep working.
//
// Usage: node scripts/backfill-uploads.mjs
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const MAX_EDGE = 2000;
const JPEG_QUALITY = 80;

const UPLOADS = path.join(process.cwd(), "public", "uploads");
const BACKUP = path.join(process.cwd(), "public", "uploads-original-backup");

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(UPLOADS))) {
    console.error("No public/uploads directory found.");
    process.exit(1);
  }

  const files = (await fs.readdir(UPLOADS)).filter((f) =>
    /\.(jpe?g|png|webp|avif)$/i.test(f)
  );
  if (files.length === 0) {
    console.log("Nothing to backfill — uploads dir is empty.");
    return;
  }

  // Backup once. If the backup dir already exists, assume a prior run did the
  // backup and skip — we don't want to overwrite original backups with the
  // already-compressed versions.
  if (await exists(BACKUP)) {
    console.log(`Backup directory already exists at ${BACKUP} — skipping backup step.`);
  } else {
    await fs.mkdir(BACKUP, { recursive: true });
    console.log(`Backing up ${files.length} files to ${BACKUP}…`);
    for (const f of files) {
      await fs.copyFile(path.join(UPLOADS, f), path.join(BACKUP, f));
    }
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  let processed = 0;
  let skipped = 0;

  for (const f of files) {
    const src = path.join(UPLOADS, f);
    const before = (await fs.stat(src)).size;
    beforeTotal += before;

    try {
      const output = await sharp(src)
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      // Write the resized JPEG under the same filename so existing references
      // in data/boxes.json keep working. If the original was .png/.webp we
      // intentionally overwrite the extension's contents with JPEG bytes —
      // browsers serve by content, not extension, so this is fine.
      await fs.writeFile(src, output);
      const after = (await fs.stat(src)).size;
      afterTotal += after;
      processed++;
      console.log(`  ${f}  ${fmtBytes(before)} → ${fmtBytes(after)}`);
    } catch (err) {
      skipped++;
      console.warn(`  ${f}  SKIPPED: ${err.message}`);
    }
  }

  console.log("");
  console.log(`Done. ${processed} processed, ${skipped} skipped.`);
  console.log(`Total: ${fmtBytes(beforeTotal)} → ${fmtBytes(afterTotal)}  (saved ${fmtBytes(beforeTotal - afterTotal)})`);
  console.log(`Originals safe in: ${BACKUP}`);
  console.log("Delete that backup once you've verified the resized images look good.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
