import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/textForensics";
import { rateLimit, getClientKey } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    const { allowed, resetAt } = rateLimit(getClientKey(request), { limit: 20, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString() } }
      );
    }

    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    if (text.length > 20000) {
      return NextResponse.json({ error: "Text too long (max 20,000 characters)." }, { status: 413 });
    }

    const result = analyzeText(text);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not analyze this text." }, { status: 500 });
  }
}
