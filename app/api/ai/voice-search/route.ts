import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { recordAiUsage } from "@/lib/ai-usage/record";

const GEMINI_MODEL = "gemini-2.5-flash";

const PARSE_PROMPT = `You are a search filter extractor for an Indian ethnic fashion product catalog.

Extract structured search filters from the user's spoken query.

Available filter values:
- category: Saree | Lehenga | Blouse | Dupatta | Kurta | Salwar | Anarkali | Sharara | Palazzo | Jewellery | Footwear | Clutch | Handbag | Suit | Tie
- occasion: Wedding | Bridal | Festive | Party | Casual | Formal | Office | Traditional | Religious | Anniversary
- gender: WOMEN | MEN | UNISEX

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "category": "<matched category or null>",
  "color": "<primary color mentioned or null>",
  "occasion": "<matched occasion or null>",
  "gender": "<matched gender or null>",
  "searchQuery": "<any remaining descriptive terms like material, style, price range — or null>",
  "interpretation": "<short human-readable summary of what was understood, e.g. 'Red wedding sarees for women'>"
}

Rules:
- Map synonyms: "sari" → Saree, "jewels/necklace/earrings" → Jewellery, "heels/sandals/shoes" → Footwear, "bag/purse" → Handbag or Clutch
- Map gender hints: "ladies/women's/female" → WOMEN, "men's/gents/male" → MEN
- Map occasion hints: "marriage" → Wedding, "puja/pooja" → Religious, "office/work" → Office
- If a term doesn't fit any filter, put it in searchQuery
- Set fields to null (not empty string) when not present`;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-gemini-api-key-here") {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const transcript: string = body.transcript?.trim() ?? "";

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const t0 = Date.now();
    const usageBase = {
      provider: "gemini",
      model: GEMINI_MODEL,
      feature: "voice_search",
      requestBytes: Buffer.byteLength(transcript, "utf8"),
      storeId: session.id,
      userId: session.id,
    } as const;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${PARSE_PROMPT}\n\nUser's spoken query: "${transcript}"`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini voice-search error:", geminiRes.status, errText);
      void recordAiUsage({
        ...usageBase,
        durationMs: Date.now() - t0,
        status: "error",
        errorMessage: `HTTP ${geminiRes.status}`,
      });
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "AI rate limit reached. Try again in a moment." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "AI parsing failed" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const usageMeta = geminiData.usageMetadata;
    void recordAiUsage({
      ...usageBase,
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs: Date.now() - t0,
      status: "success",
    });
    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let filters: Record<string, string | null>;
    try {
      filters = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse Gemini voice response:", jsonText);
      // Fallback: treat entire transcript as a text search
      return NextResponse.json({
        filters: {
          category: null,
          color: null,
          occasion: null,
          gender: null,
          searchQuery: transcript,
          interpretation: transcript,
        },
        transcript,
      });
    }

    // Sanitize nulls vs undefined
    const sanitized = {
      category: filters.category || null,
      color: filters.color || null,
      occasion: filters.occasion || null,
      gender: filters.gender || null,
      searchQuery: filters.searchQuery || null,
      interpretation: filters.interpretation || transcript,
    };

    return NextResponse.json({ filters: sanitized, transcript });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("voice-search error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
