import { NextResponse } from "next/server";
import { analyzeImage } from "@/lib/imageForensics";
import { rateLimit, getClientKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Allows the companion browser extension (a different origin, since it
// runs from chrome-extension://...) to call this endpoint directly.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { allowed, remaining, resetAt } = rateLimit(getClientKey(request), {
      limit: 20,
      windowMs: 60_000
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        {
          status: 429,
          headers: { ...CORS_HEADERS, "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString() }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400, headers: CORS_HEADERS });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 413, headers: CORS_HEADERS });
    }

    const result = await analyzeImage(buffer);
    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Could not analyze this file. It may not be a supported image format." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
