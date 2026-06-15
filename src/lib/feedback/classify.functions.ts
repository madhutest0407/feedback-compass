import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { heuristicClassify } from "./heuristics";
import { SOURCES, type ClassifiedFeedback, type RawFeedback } from "./types";

const RawFeedbackSchema = z.object({
  id: z.string(),
  source: z.enum(SOURCES),
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  author: z.string().optional(),
  date: z.string().optional(),
  rating: z.number().optional(),
});

const ClassifyInput = z.object({
  items: z.array(RawFeedbackSchema),
});

type AIClassification = {
  id: string;
  sentiment: "positive" | "negative" | "neutral";
  severity?: "critical" | "major" | "minor";
  impact?: "high" | "low";
  theme: string;
  reason: string;
};

async function callAIGateway(items: RawFeedback[]): Promise<AIClassification[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    text: `${i.title}\n${i.snippet}`.slice(0, 800),
  }));

  const systemPrompt = `You classify customer feedback items. For each item, return:
- sentiment: positive | negative | neutral
- severity (only when negative): critical | major | minor
  - critical: data loss, security, billing fraud, broken core flow, churn-causing
  - major: real pain, blocking workflow, frequent complaint
  - minor: small annoyance, nitpick
- impact (only when positive): high | low
  - high: enthusiastic recommendation, "game changer", strong promoter
  - low: mild positive
- theme: 1-3 word lowercase topic (e.g. "pricing", "onboarding", "bugs", "support", "ux", "performance", "features", "reliability", "integrations")
- reason: one sentence justification (<= 140 chars)

Return STRICT JSON only: { "classifications": [ { "id": "...", "sentiment": "...", ... } ] }`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("AI_RATE_LIMIT: AI gateway rate limit hit. Try again shortly.");
  if (res.status === 402) throw new Error("AI_CREDITS: AI credits exhausted. Add credits in workspace billing.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI gateway returned no content");

  let parsed: { classifications?: AIClassification[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    // Some models wrap json in ```json fences
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  }
  return parsed.classifications ?? [];
}

export const classifyFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClassifyInput.parse(input))
  .handler(async ({ data }): Promise<{ items: ClassifiedFeedback[] }> => {
    const out: ClassifiedFeedback[] = [];
    const ambiguous: RawFeedback[] = [];

    for (const raw of data.items) {
      const h = heuristicClassify(raw);
      if (h) out.push(h);
      else ambiguous.push(raw);
    }

    if (ambiguous.length > 0) {
      try {
        // Batch in groups of 15 to keep prompts small
        const batches: RawFeedback[][] = [];
        for (let i = 0; i < ambiguous.length; i += 15) batches.push(ambiguous.slice(i, i + 15));

        const allClassifications: AIClassification[] = [];
        for (const batch of batches) {
          const cls = await callAIGateway(batch);
          allClassifications.push(...cls);
        }
        const byId = new Map(allClassifications.map((c) => [c.id, c]));
        for (const raw of ambiguous) {
          const c = byId.get(raw.id);
          if (c) {
            out.push({
              ...raw,
              sentiment: c.sentiment,
              severity: c.sentiment === "negative" ? (c.severity ?? "minor") : undefined,
              impact: c.sentiment === "positive" ? (c.impact ?? "low") : undefined,
              theme: c.theme || "general",
              reason: c.reason || "AI classification",
              classifiedBy: "ai",
            });
          } else {
            // AI didn't return this id — fall back to neutral
            out.push({
              ...raw,
              sentiment: "neutral",
              theme: "general",
              reason: "Unclassified",
              classifiedBy: "ai",
            });
          }
        }
      } catch (err) {
        // If AI fails, mark ambiguous as neutral so the view still renders
        const message = err instanceof Error ? err.message : String(err);
        for (const raw of ambiguous) {
          out.push({
            ...raw,
            sentiment: "neutral",
            theme: "general",
            reason: `AI unavailable: ${message.slice(0, 80)}`,
            classifiedBy: "ai",
          });
        }
      }
    }

    return { items: out };
  });
