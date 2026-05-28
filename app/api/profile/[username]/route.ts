import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { boxes as staticBoxes } from "@/lib/data";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_PATH = path.join(process.cwd(), "data", "boxes.json");

function allBoxes() {
  try {
    const extra = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    return [...staticBoxes, ...extra];
  } catch {
    return staticBoxes;
  }
}

// GET /api/profile/[username] — returns { username, boxes: Box[] }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Look up user id by username
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  // Fetch their collected box IDs
  const { data: collection } = await supabase
    .from("collections")
    .select("box_id")
    .eq("user_id", profile.id);

  const ids = new Set((collection ?? []).map((r: { box_id: number }) => r.box_id));
  const collectedBoxes = allBoxes().filter((b) => ids.has(b.id) && b.images?.length);

  return NextResponse.json({ username: profile.username, boxes: collectedBoxes });
}
