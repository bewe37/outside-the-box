import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/profile — upsert username for the authenticated user
export async function POST(req: NextRequest) {
  const { username } = await req.json();

  if (!username || !/^[a-z0-9_-]{2,24}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username. Use 2–24 lowercase letters, numbers, _ or -." }, { status: 400 });
  }

  // Verify the caller's JWT
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check username isn't taken by someone else
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Username already taken." }, { status: 409 });

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ username });
}
