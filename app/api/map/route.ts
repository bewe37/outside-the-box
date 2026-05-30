import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", "15");
  url.searchParams.set("size", "480x320");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("markers", `color:0x202020|${lat},${lng}`);
  url.searchParams.set("style", "feature:all|element:labels.text.fill|color:0x888888");
  url.searchParams.set("style", "feature:poi|visibility:off");
  url.searchParams.set("style", "feature:transit|visibility:off");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return NextResponse.json({ error: "Map fetch failed" }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
