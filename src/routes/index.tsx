import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Zap, Layers, TrendingUp } from "lucide-react";

import { SearchBar } from "@/components/feedback/SearchBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoxPulse — Customer Voice Analyser" },
      {
        name: "description",
        content:
          "Search customer feedback across Reddit, Twitter, G2, Capterra, and Trustpilot. Prioritized by sentiment, scored for analysts.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          <Sparkles className="size-3" /> For Product Managers
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-snug">
          See what customers really think,{" "}
          <span className="text-muted-foreground">across the entire web.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          One search pulls feedback from Reddit, Twitter, G2, Capterra, and Trustpilot. We
          classify each item by sentiment and severity so you can ship the right fix first.
          Save searches as views and refresh anytime.
        </p>
      </div>

      <SearchBar autoFocus />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
        <Feature
          icon={Layers}
          title="5 Sources, One Feed"
          body="Reddit threads, X/Twitter posts, and verified G2 / Capterra / Trustpilot reviews — deduplicated and grouped."
        />
        <Feature
          icon={Zap}
          title="Severity-First Prioritization"
          body="Critical, major, minor for negative — high vs low impact for positive. So the loudest issues surface immediately."
        />
        <Feature
          icon={TrendingUp}
          title="Scorecard + Trend"
          body="A 0–100 sentiment score, a theme breakdown, and a trend line that grows every time you refresh."
        />
      </div>

    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="border rounded-xl p-4 bg-card">
      <Icon className="size-4 mb-2 text-primary" />
      <div className="font-medium text-sm">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </div>
  );
}
