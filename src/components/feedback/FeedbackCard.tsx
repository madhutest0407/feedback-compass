import { ExternalLink, Star } from "lucide-react";

import type { ClassifiedFeedback } from "@/lib/feedback/types";
import { SOURCE_LABELS } from "@/lib/feedback/types";
import { Badge } from "@/components/ui/badge";

function severityTone(item: ClassifiedFeedback) {
  if (item.sentiment === "negative") {
    if (item.severity === "critical") return "border-l-rose-500";
    if (item.severity === "major") return "border-l-orange-500";
    return "border-l-amber-400";
  }
  if (item.sentiment === "positive") {
    return item.impact === "high" ? "border-l-emerald-500" : "border-l-emerald-300";
  }
  return "border-l-slate-300";
}

const SOURCE_COLOR: Record<string, string> = {
  reddit: "bg-orange-100 text-orange-700",
  twitter: "bg-sky-100 text-sky-700",
  g2: "bg-rose-100 text-rose-700",
  capterra: "bg-violet-100 text-violet-700",
  trustpilot: "bg-emerald-100 text-emerald-700",
};

export function FeedbackCard({ item }: { item: ClassifiedFeedback }) {
  return (
    <article
      className={`border border-l-4 rounded-lg bg-card p-4 hover:shadow-sm transition ${severityTone(item)}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="secondary" className={`text-[10px] ${SOURCE_COLOR[item.source]}`}>
              {SOURCE_LABELS[item.source]}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">
              {item.theme}
            </Badge>
            {typeof item.rating === "number" && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <Star className="size-3 fill-amber-500 stroke-amber-500" />
                {item.rating}/5
              </span>
            )}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-auto">
              {item.classifiedBy === "ai" ? "AI classified" : "Heuristic"}
            </span>
          </div>
          <h3 className="font-medium text-sm leading-snug mb-1 line-clamp-2">
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
            {item.snippet || "No preview available."}
          </p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-xs italic text-muted-foreground line-clamp-1">
              {item.reason}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground hover:underline flex items-center gap-1 shrink-0"
            >
              Open <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
