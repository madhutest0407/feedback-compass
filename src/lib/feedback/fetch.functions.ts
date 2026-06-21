import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SOURCES, type RawFeedback, type Source, type Timeframe } from "./types";

const SourceEnum = z.enum(SOURCES);
const TimeframeEnum = z.enum(["day", "week", "month", "year", "all"] as const);

const FetchInput = z.object({
  keyword: z.string().min(1).max(200),
  sources: z.array(SourceEnum).min(1),
  timeframe: TimeframeEnum,
  perSourceLimit: z.number().int().min(1).max(20).default(5),
});

const SOURCE_SITE: Record<Source, string> = {
  reddit: "reddit.com",
  twitter: "x.com OR site:twitter.com",
  g2: "g2.com",
  capterra: "capterra.com",
  trustpilot: "trustpilot.com",
};

const TIMEFRAME_TBS: Record<Timeframe, string | undefined> = {
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
  all: undefined,
};

type FirecrawlSearchHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit: number,
  tbs: string | undefined,
): Promise<FirecrawlSearchHit[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit,
      ...(tbs ? { tbs } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { web?: FirecrawlSearchHit[] } | FirecrawlSearchHit[] };
  const data = json.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.web)) return data.web;
  return [];
}

function extractRating(text: string): number | undefined {
  // Look for patterns like "3/5", "4 out of 5", "★★★☆☆"
  const slash = text.match(/(\d(?:\.\d)?)\s*\/\s*5\b/);
  if (slash) return parseFloat(slash[1]);
  const outOf = text.match(/(\d(?:\.\d)?)\s*out of\s*5/i);
  if (outOf) return parseFloat(outOf[1]);
  const stars = text.match(/★+/);
  if (stars) return Math.min(5, stars[0].length);
  return undefined;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Weighted relevance score for a search result against a keyword.
 *
 * Tiered signals (highest → lowest confidence):
 *   Tier 1 — exact phrase in title/snippet/URL slug
 *   Tier 2 — all query words present in title
 *   Tier 3 — all query words present in snippet or combined text
 *
 * Callers apply a minimum threshold based on query word count:
 *   1 word  → score ≥ 1  (any mention)
 *   2 words → score ≥ 2  (both words must appear — even a Zoho Mail page that
 *                          discusses Zoho Calendar integration counts as relevant)
 *   3+ words → score ≥ 3 (majority of words must appear, or a strong phrase hit)
 */
function computeRelevance(keyword: string, url: string, title: string, snippet: string): number {
  const phrase = keyword.toLowerCase().trim();
  const words = phrase.split(/\s+/).filter(Boolean);
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const snippetLower = snippet.toLowerCase();

  let score = 0;

  // Tier 1: exact phrase
  if (titleLower.includes(phrase)) score += 10;
  if (snippetLower.includes(phrase)) score += 8;

  // Tier 2: URL slug variants — product names often appear as slugs
  const slugs = [
    phrase.replace(/\s+/g, "-"),   // zoho-calendar
    phrase.replace(/\s+/g, "_"),   // zoho_calendar
    phrase.replace(/\s+/g, ""),    // zohocalendar
  ];
  if (slugs.some((s) => urlLower.includes(s))) score += 7;

  // Tier 3: word-level coverage
  if (words.length === 1) {
    if (`${titleLower} ${snippetLower}`.includes(phrase)) score += 5;
  } else {
    const combined = `${titleLower} ${snippetLower}`;
    const allInTitle = words.every((w) => titleLower.includes(w));
    const allInSnippet = words.every((w) => snippetLower.includes(w));
    const allInCombined = words.every((w) => combined.includes(w));

    if (allInTitle) score += 6;
    else if (allInSnippet) score += 4;
    else if (allInCombined) score += 2;
  }

  return score;
}

function matchesSource(url: string, source: Source): boolean {
  const host = hostnameOf(url);
  switch (source) {
    case "reddit":
      return host.endsWith("reddit.com");
    case "twitter":
      return host.endsWith("x.com") || host.endsWith("twitter.com");
    case "g2":
      return host.endsWith("g2.com");
    case "capterra":
      return host.endsWith("capterra.com");
    case "trustpilot":
      return host.endsWith("trustpilot.com");
  }
}

export type FetchFeedbackResult = {
  items: RawFeedback[];
  errors: Array<{ source: Source; message: string }>;
};

export const fetchFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FetchInput.parse(input))
  .handler(async ({ data }): Promise<FetchFeedbackResult> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "MISSING_FIRECRAWL_KEY: Firecrawl is not connected. Link the Firecrawl connector to enable feedback fetching.",
      );
    }

    const tbs = TIMEFRAME_TBS[data.timeframe];

    const results = await Promise.allSettled(
      data.sources.map(async (source) => {
        const site = SOURCE_SITE[source];
        const reviewSuffix =
          source === "g2" || source === "capterra" || source === "trustpilot" ? " review" : "";
        // Wrap keyword in quotes to enforce exact phrase match on the search engine
        const query = `site:${site} "${data.keyword}"${reviewSuffix}`;
        const hits = await firecrawlSearch(apiKey, query, data.perSourceLimit, tbs);

        const words = data.keyword.toLowerCase().trim().split(/\s+/).filter(Boolean);
        // Minimum relevance score by query length (see computeRelevance for scoring details)
        const MIN_SCORE = words.length === 1 ? 1 : words.length === 2 ? 2 : 3;

        const items: RawFeedback[] = [];
        for (const hit of hits) {
          if (!hit.url || !matchesSource(hit.url, source)) continue;
          const snippet = (hit.description ?? hit.markdown ?? "").slice(0, 900);
          const relevance = computeRelevance(data.keyword, hit.url, hit.title ?? "", snippet);
          if (relevance < MIN_SCORE) continue;

          items.push({
            id: `${source}:${hit.url}`,
            source,
            url: hit.url,
            title: hit.title ?? hit.url,
            snippet,
            rating: extractRating(`${hit.title ?? ""} ${snippet}`),
          });
        }
        return { source, items };
      }),
    );

    const items: RawFeedback[] = [];
    const errors: Array<{ source: Source; message: string }> = [];

    results.forEach((r, idx) => {
      const source = data.sources[idx];
      if (r.status === "fulfilled") {
        items.push(...r.value.items);
      } else {
        errors.push({
          source,
          message: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });

    return { items, errors };
  });
