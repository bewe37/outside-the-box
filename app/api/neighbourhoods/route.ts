import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "neighbourhoods.json");

// Public: custom neighbourhoods added via the admin panel (built-ins live in lib/data).
export async function GET() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    return NextResponse.json(Array.isArray(parsed) ? parsed : []);
  } catch {
    return NextResponse.json([]);
  }
}
