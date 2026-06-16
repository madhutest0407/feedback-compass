import { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Sparkles,
  Heart,
  Filter,
} from "lucide-react";

import { FeedbackCard } from "./FeedbackCard";
import type { ClassifiedFeedback, Source } from "@/lib/feedback/types";
import { SOURCES, SOURCE_LABELS } from "@/lib/feedback/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Bucket = {
  key: "critical" | "major" | "minor" | "highImpact" | "lowImpact";
  label: string;
  description: string;
  icon: typeof AlertOctagon;
  accent: string;
  filter: (i: ClassifiedFeedback) => boolean;
};

const BUCKETS: Bucket[] = [
  {
    key: "critical",
    label: "Critical",
    description: "Churn-risk, broken core flows, data/security/billing",
    icon: AlertOctagon,
    accent: "text-rose-600",
    filter: (i) => i.sentiment === "negative" && i.severity === "critical",
  },
  {
    key: "major",
    label: "Major",
    description: "Blocking pain points and frequent complaints",
    icon: AlertTriangle,
    accent: "text-orange-600",
    filter: (i) => i.sentiment === "negative" && i.severity === "major",
  },
  {
    key: "minor",
    label: "Minor",
    description: "Small annoyances and nitpicks",
    icon: Info,
    accent: "text-amber-600",
    filter: (i) => i.sentiment === "negative" && i.severity === "minor",
  },
  {
    key: "highImpact",
    label: "Positive — High impact",
    description: "Strong promoters and enthusiastic praise",
    icon: Sparkles,
    accent: "text-emerald-600",
    filter: (i) => i.sentiment === "positive" && i.impact === "high",
  },
  {
    key: "lowImpact",
    label: "Positive — Low impact",
    description: "Mild positive mentions",
    icon: Heart,
    accent: "text-emerald-500",
    filter: (i) => i.sentiment === "positive" && i.impact === "low",
  },
];

export function FeedbackSections({ items }: { items: ClassifiedFeedback[] }) {
  const [sourceFilter, setSourceFilter] = useState<Source[]>([...SOURCES]);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const allThemes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.theme));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (!sourceFilter.includes(i.source)) return false;
      if (themeFilter && i.theme !== themeFilter) return false;
      if (words.length > 0) {
        const text = `${i.title} ${i.snippet}`.toLowerCase();
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    });
  }, [items, sourceFilter, themeFilter, query]);

  const toggleSource = (s: Source) =>
    setSourceFilter((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4" /> Filter By
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map((s) => {
            const active = sourceFilter.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            );
          })}
        </div>
        {allThemes.length > 0 && (
          <select
            value={themeFilter ?? ""}
            onChange={(e) => setThemeFilter(e.target.value || null)}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            <option value="">All Themes</option>
            {allThemes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <Input
          placeholder="Search Within Results…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 max-w-xs ml-auto text-sm"
        />
        {(themeFilter || query || sourceFilter.length !== SOURCES.length) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSourceFilter([...SOURCES]);
              setThemeFilter(null);
              setQuery("");
            }}
          >
            Clear
          </Button>
        )}
        <div className="text-xs text-muted-foreground ml-auto">
          Showing {filtered.length} Of {items.length}
        </div>
      </div>

      {BUCKETS.map((b) => {
        const bucketItems = filtered.filter(b.filter);
        if (bucketItems.length === 0) return null;
        const Icon = b.icon;
        return (
          <section key={b.key}>
            <header className="flex items-baseline gap-3 mb-3">
              <Icon className={`size-5 ${b.accent}`} />
              <h2 className="text-lg font-semibold">{b.label}</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {bucketItems.length}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">— {b.description}</span>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bucketItems.map((item) => (
                <FeedbackCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground border rounded-xl bg-card">
          No feedback matches the current filters.
        </div>
      )}
    </div>
  );
}
