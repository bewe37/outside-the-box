import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "boxes.json");

export async function GET() {
  try {
    const extra = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    return NextResponse.json(extra);
  } catch {
    return NextResponse.json([]);
  }
}
