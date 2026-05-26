import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../public/stamps.png");
const OUT = join(__dirname, "../public/stamps");

const COLS = 5;
const ROWS = 3;

const meta = await sharp(SRC).metadata();
console.log(`Sheet: ${meta.width} × ${meta.height}`);

const stampW = Math.floor(meta.width / COLS);
const stampH = Math.floor(meta.height / ROWS);
console.log(`Each stamp: ${stampW} × ${stampH}`);

await mkdir(OUT, { recursive: true });

let index = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const left = col * stampW;
    const top = row * stampH;
    const outFile = join(OUT, `${String(index + 1).padStart(2, "0")}.png`);

    await sharp(SRC)
      .extract({ left, top, width: stampW, height: stampH })
      .toFile(outFile);

    console.log(`  stamp ${index + 1} → col ${col}, row ${row} (${left},${top}) → ${outFile.split("public")[1]}`);
    index++;
  }
}

console.log(`\nDone. ${index} stamps saved to /public/stamps/`);
