import { NextResponse } from "next/server";
import { fallbackBrandSpec, normalizeBrandSpec, type BrandSpec } from "@/lib/brandSpec";

/**
 * Generates a tailored "homepage concept" (BrandSpec) for a prospect's business
 * from their 2-sentence description, used to render a branded homepage MOCK in
 * the free Build Blueprint. Uses the Anthropic API for the real, AI-written
 * concept; degrades to a deterministic per-vertical fallback when no
 * ANTHROPIC_API_KEY is configured or anything fails — so the section always
 * renders. Pure concept: nothing here connects to a database.
 */
export const dynamic = "force-dynamic";

type Body = {
  businessName?: string;
  vertical?: string;
  description?: string;
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are a senior brand & web designer. Given a small business's name, type and a short description, design a homepage concept for THEIR own website (not a template). Respond with ONLY a JSON object — no markdown, no prose — matching exactly:
{
  "businessName": string,
  "tagline": string,                // <= 6 words
  "heroHeadline": string,           // punchy, <= 9 words, specific to them
  "heroSub": string,                // one warm sentence, <= 28 words
  "ctaLabel": string,               // e.g. "Book an appointment"
  "sections": [ { "title": string, "blurb": string }, x3 ],  // 3 benefits, blurb <= 22 words
  "palette": { "primary": "#RRGGBB", "bg": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "muted": "#RRGGBB", "accent": "#RRGGBB" },
  "vibe": string                    // 3-4 adjectives
}
Choose a palette that fits the business's character (a calm clinic vs a bold salon). Prefer a LIGHT background (bg/surface near white) with a confident primary colour — this is a real customer-facing website. Copy must sound like this specific business, using their own words where natural. British English.`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const businessName = (body.businessName || "").trim().slice(0, 80) || null;
  const vertical = (body.vertical || "").trim().slice(0, 40) || null;
  const description = (body.description || "").trim().slice(0, 600) || null;

  const base = fallbackBrandSpec({ businessName, vertical, description });

  // Nothing to tailor, or AI unconfigured → return the deterministic concept.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !description) {
    return NextResponse.json({ spec: base });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Business name: ${businessName ?? "(not given)"}\nType: ${vertical ?? "small business"}\nDescription: ${description}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("brand-preview: Anthropic", res.status);
      return NextResponse.json({ spec: base });
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const parsed = extractJson(text);
    const spec: BrandSpec = normalizeBrandSpec(parsed, base);
    return NextResponse.json({ spec });
  } catch (e) {
    console.error("brand-preview failed (non-fatal):", e);
    return NextResponse.json({ spec: base });
  }
}
