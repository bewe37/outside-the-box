import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_EDGE = 2000;
const BUCKET = "user-photos";

// POST — upload a custom photo for a collected box
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const boxId = Number(formData.get("box_id"));

  if (!file || !boxId) return NextResponse.json({ error: "Missing file or box_id" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });

  // Resize client-side isn't possible in a route handler without sharp,
  // so just cap at 10MB and upload as-is — Supabase Storage serves it fine.
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${user.id}/${boxId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // Upsert record so we can query it easily
  await supabase.from("user_photos").upsert(
    { user_id: user.id, box_id: boxId, url: publicUrl },
    { onConflict: "user_id,box_id" }
  );

  return NextResponse.json({ url: publicUrl });
}

// GET ?box_ids=1,2,3 — returns { [box_id]: url } map for the authenticated user
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({});

  const ids = (req.nextUrl.searchParams.get("box_ids") ?? "")
    .split(",").map(Number).filter(Boolean);

  if (ids.length === 0) return NextResponse.json({});

  const { data } = await supabase
    .from("user_photos")
    .select("box_id, url")
    .eq("user_id", user.id)
    .in("box_id", ids);

  const map: Record<number, string> = {};
  (data ?? []).forEach((r: { box_id: number; url: string }) => { map[r.box_id] = r.url; });
  return NextResponse.json(map);
}
