import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { FeedbackWorkspace } from "@/components/feedback/FeedbackWorkspace";
import { SOURCES, TIMEFRAMES, type Source, type Timeframe } from "@/lib/feedback/types";

const SearchParams = z.object({
  q: z.string().min(1),
  sources: z.string().default(SOURCES.join(",")),
  tf: z.enum(TIMEFRAMES).default("month"),
});

export const Route = createFileRoute("/search")({
  validateSearch: (s) => SearchParams.parse(s),
  head: ({ match }) => {
    const q = (match.search as { q?: string }).q ?? "feedback";
    return {
      meta: [
        { title: `“${q}” — VoxPulse` },
        { name: "description", content: `Customer feedback for "${q}" across Reddit, Twitter, G2, Capterra, and Trustpilot.` },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q, sources: sourcesParam, tf } = Route.useSearch();
  const sources = sourcesParam
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string): s is Source => (SOURCES as readonly string[]).includes(s));

  return (
    <FeedbackWorkspace
      keyword={q}
      sources={sources.length ? sources : [...SOURCES]}
      timeframe={tf as Timeframe}
    />
  );
}
