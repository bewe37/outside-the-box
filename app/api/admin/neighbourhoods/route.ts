import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/admin-auth";
import { NEIGHBOURHOODS } from "@/lib/data";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "neighbourhoods.json");

function readCustom(): string[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustom(list: string[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2));
}

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(readCustom());
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name || "").trim().toUpperCase();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const custom = readCustom();
  const exists =
    NEIGHBOURHOODS.includes(name) || custom.includes(name);
  if (exists) {
    return NextResponse.json({ error: "Already exists." }, { status: 409 });
  }

  custom.push(name);
  writeCustom(custom);
  return NextResponse.json(custom, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  const custom = readCustom().filter((n) => n !== name);
  writeCustom(custom);
  return NextResponse.json(custom);
}
