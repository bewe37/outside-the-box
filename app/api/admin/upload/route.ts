import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/admin-auth";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// Resize uploads to a sensible max edge with JPEG quality 80. iPhone shots come
// in at ~13MB / 4032px wide; nothing in the UI needs more than ~2000px.
const MAX_EDGE = 2000;
const JPEG_QUALITY = 80;

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp", "avif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Always write JPEG: smaller than PNG for photos, universally fast to decode.
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  try {
    // rotate() honours EXIF orientation (iPhone photos rely on it).
    // Resize without enlarging so already-small images are left alone.
    const output = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(path.join(uploadsDir, filename), output);
  } catch (err) {
    console.error("Image processing failed:", err);
    return NextResponse.json({ error: "Could not process image" }, { status: 422 });
  }

  return NextResponse.json({ path: `/uploads/${filename}` });
}
