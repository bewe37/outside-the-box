import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/admin-auth";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "boxes.json");

function readBoxes() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeBoxes(boxes: unknown[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(boxes, null, 2));
}

// Year is a 4-digit number, or the literal "UNKNOWN".
function normalizeYear(value: unknown): number | "UNKNOWN" {
  if (value === "UNKNOWN") return "UNKNOWN";
  return Number(value) || new Date().getFullYear();
}

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(readBoxes());
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const boxes = readBoxes();

  // Compute next ID beyond all static + dynamic boxes
  const { boxes: staticBoxes } = await import("@/lib/data");
  const allIds = [...staticBoxes.map((b: { id: number }) => b.id), ...boxes.map((b: { id: number }) => b.id)];
  const nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;

  const newBox = {
    id: nextId,
    title: String(body.title || "").toUpperCase(),
    address: body.address || "",
    neighbourhood: body.neighbourhood || "",
    artist: body.artist || "",
    year: normalizeYear(body.year),
    captured: body.captured || new Date().toLocaleDateString("en-US"),
    description: typeof body.description === "string" ? body.description.trim() : "",
    images: Array.isArray(body.images) ? body.images : [],
  };

  boxes.push(newBox);
  writeBoxes(boxes);

  return NextResponse.json(newBox, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const id = Number(body.id);
  const boxes = readBoxes();
  const idx = boxes.findIndex((b: { id: number }) => b.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = {
    ...boxes[idx],
    title: String(body.title || "").toUpperCase(),
    address: body.address || "",
    neighbourhood: body.neighbourhood || "",
    artist: body.artist || "",
    year: normalizeYear(body.year),
    captured: body.captured || boxes[idx].captured,
    description: typeof body.description === "string" ? body.description.trim() : "",
    images: Array.isArray(body.images) ? body.images : [],
  };

  boxes[idx] = updated;
  writeBoxes(boxes);

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const boxes = readBoxes();
  const filtered = boxes.filter((b: { id: number }) => b.id !== id);
  writeBoxes(filtered);

  return NextResponse.json({ ok: true });
}
