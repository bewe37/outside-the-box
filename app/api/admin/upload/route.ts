import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/admin-auth";
import { put } from "@vercel/blob";
import sharp from "sharp";

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

  const filename = `boxes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("Image processing failed:", err);
    return NextResponse.json({ error: "Could not process image" }, { status: 422 });
  }

  const blob = await put(filename, output, {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ path: blob.url });
}
