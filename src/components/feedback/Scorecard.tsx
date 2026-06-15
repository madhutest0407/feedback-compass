import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import type { ClassifiedFeedback, FetchHistoryPoint, Source } from "@/lib/feedback/types";
import { SOURCES, SOURCE_LABELS } from "@/lib/feedback/types";
import { computeCounts, computeScore } from "@/lib/feedback/heuristics";
import { format } from "date-fns";

function scoreTone(score: number) {
  if (score >= 70) return { text: "text-emerald-600", bg: "bg-emerald-50", label: "Healthy" };
  if (score >= 55) return { text: "text-lime-600", bg: "bg-lime-50", label: "Stable" };
  if (score >= 40) return { text: "text-amber-600", bg: "bg-amber-50", label: "Watch" };
  if (score >= 25) return { text: "text-orange-600", bg: "bg-orange-50", label: "Concerning" };
  return { text: "text-rose-600", bg: "bg-rose-50", label: "Critical" };
}

const SEVERITY_COLORS = {
  critical: "#f43f5e",
  major: "#f97316",
  minor: "#f59e0b",
  highImpact: "#10b981",
  lowImpact: "#86efac",
};

export function Scorecard({
  items,
  history,
}: {
  items: ClassifiedFeedback[];
  history: FetchHistoryPoint[];
}) {
  const score = useMemo(() => computeScore(items), [items]);
  const counts = useMemo(() => computeCounts(items), [items]);
  const tone = scoreTone(score);

  const previousScore = history.length >= 2 ? history[history.length - 2].score : null;
  const delta = previousScore !== null ? score - previousScore : null;

  const bySource = useMemo(() => {
    return SOURCES.map((s: Source) => ({
      source: SOURCE_LABELS[s],
      count: items.filter((i) => i.source === s).length,
    })).filter((d) => d.count > 0);
  }, [items]);

  const bySeverity = useMemo(() => {
    return [
      { name: "Critical", value: counts.critical, color: SEVERITY_COLORS.critical },
      { name: "Major", value: counts.major, color: SEVERITY_COLORS.major },
      { name: "Minor", value: counts.minor, color: SEVERITY_COLORS.minor },
      { name: "Pos. high", value: counts.highImpact, color: SEVERITY_COLORS.highImpact },
      { name: "Pos. low", value: counts.lowImpact, color: SEVERITY_COLORS.lowImpact },
    ].filter((d) => d.value > 0);
  }, [counts]);

  const themes = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => map.set(i.theme, (map.get(i.theme) ?? 0) + 1));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [items]);

  const trend = useMemo(
    () =>
      history.map((p) => ({
        time: format(new Date(p.fetchedAt), "MMM d HH:mm"),
        score: p.score,
      })),
    [history],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Score card */}
      <div className={`lg:col-span-3 rounded-2xl border p-5 ${tone.bg}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sentiment Score
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <div className={`text-6xl font-bold tabular-nums ${tone.text}`}>{score}</div>
          <div className="text-sm text-muted-foreground">/ 100</div>
        </div>
        <div className={`text-sm font-medium mt-1 ${tone.text}`}>{tone.label}</div>
        {delta !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
            {delta > 0 ? (
              <TrendingUp className="size-3.5 text-emerald-600" />
            ) : delta < 0 ? (
              <TrendingDown className="size-3.5 text-rose-600" />
            ) : (
              <Minus className="size-3.5" />
            )}
            <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : ""}>
              {delta > 0 ? "+" : ""}
              {delta} vs previous
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-foreground/10">
          <Stat label="Total" value={counts.total} />
          <Stat label="Negative" value={counts.critical + counts.major + counts.minor} tone="text-rose-600" />
          <Stat label="Positive" value={counts.highImpact + counts.lowImpact} tone="text-emerald-600" />
        </div>
      </div>

      {/* Severity donut */}
      <div className="lg:col-span-3 rounded-2xl border p-5 bg-card">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Breakdown
        </div>
        {bySeverity.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={bySeverity}
                  dataKey="value"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                >
                  {bySeverity.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 text-[11px] mt-2">
          {bySeverity.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="ml-auto tabular-nums font-medium">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Source volume */}
      <div className="lg:col-span-3 rounded-2xl border p-5 bg-card">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Volume by source
        </div>
        {bySource.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={bySource} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trend */}
      <div className="lg:col-span-3 rounded-2xl border p-5 bg-card">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Sentiment over time
        </div>
        {trend.length < 2 ? (
          <div className="h-40 grid place-items-center text-xs text-muted-foreground text-center px-4">
            Refresh this view a few times to build a trend line.
          </div>
        ) : (
          <div className="h-40">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#0f172a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Themes */}
      <div className="lg:col-span-12 rounded-2xl border p-5 bg-card">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Top themes
        </div>
        {themes.length === 0 ? (
          <div className="text-xs text-muted-foreground">No themes detected yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {themes.map(([theme, n]) => (
              <span
                key={theme}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-sm capitalize"
              >
                {theme}
                <span className="text-[10px] tabular-nums bg-foreground text-background rounded-full px-1.5 py-0.5">
                  {n}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-40 grid place-items-center text-xs text-muted-foreground">
      No data yet
    </div>
  );
}
