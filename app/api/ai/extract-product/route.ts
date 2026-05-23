import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const EXTRACTION_PROMPT = `Indian ethnic fashion product image. Return raw JSON only, no markdown:
{"title":"","description":"2-3 sentences","category":"Saree|Lehenga|Blouse|Dupatta|Kurta|Salwar|Anarkali|Sharara|Palazzo|Jewellery|Footwear|Clutch|Handbag|Suit|Tie|Other","subcategory":"or empty string","color":"primary color","material":"Silk|Cotton|Chiffon|Georgette|Velvet|Banarasi|Kanjeevaram|Linen|Crepe|Net|Satin|Polyester|Organza|Khadi|Wool|Gold|best guess","gender":"WOMEN|MEN|UNISEX|GIRLS|BOYS","occasion":[],"styleTags":[],"season":[],"price":0}
occasion options: Wedding Bridal Festive Party Casual Formal Office Traditional Religious Anniversary
styleTags options: Ethnic Boho Minimalist Traditional Contemporary Fusion Royal Bridal Casual Festive
season options: Spring Summer Autumn Winter All Season
price: integer INR estimate based on quality. Arrays may be empty. Use "Other" for unknown category.`;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-gemini-api-key-here") {
      return NextResponse.json(
        { error: "Gemini API key not configured. Add GEMINI_API_KEY to your .env file." },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF are supported" },
        { status: 400 }
      );
    }

    // Convert image to base64 for Gemini inline_data
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

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
                  inline_data: {
                    mime_type: file.type,
                    data: base64,
                  },
                },
                { text: EXTRACTION_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2, // low temperature for consistent structured output
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);

      // Surface quota / auth errors clearly
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return NextResponse.json(
          { error: "Invalid Gemini API key. Check your GEMINI_API_KEY." },
          { status: 503 }
        );
      }
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "Gemini rate limit reached. Try again in a moment." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "AI extraction failed. Please fill the form manually." },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      return NextResponse.json(
        { error: "No response from Gemini. Please fill the form manually." },
        { status: 502 }
      );
    }

    // Parse — strip markdown fences if Gemini wraps anyway
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let product: Record<string, unknown>;
    try {
      product = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse Gemini JSON:", jsonText);
      return NextResponse.json(
        { error: "AI returned unexpected format. Please fill the form manually." },
        { status: 502 }
      );
    }

    // Sanitize — ensure arrays are arrays, price is a number
    const sanitized = {
      title: String(product.title || ""),
      description: String(product.description || ""),
      category: String(product.category || "Other"),
      subcategory: String(product.subcategory || ""),
      color: String(product.color || ""),
      material: String(product.material || ""),
      gender: String(product.gender || "WOMEN"),
      occasion: Array.isArray(product.occasion) ? product.occasion.map(String) : [],
      styleTags: Array.isArray(product.styleTags) ? product.styleTags.map(String) : [],
      season: Array.isArray(product.season) ? product.season.map(String) : [],
      price: typeof product.price === "number" ? product.price : parseFloat(String(product.price)) || 0,
    };

    return NextResponse.json({ product: sanitized });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("extract-product error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
