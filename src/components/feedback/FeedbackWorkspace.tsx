import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  Loader2,
  AlertTriangle,
  Link as LinkIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { fetchFeedback } from "@/lib/feedback/fetch.functions";
import { classifyFeedback } from "@/lib/feedback/classify.functions";
import { Scorecard } from "@/components/feedback/Scorecard";
import { FeedbackSections } from "@/components/feedback/FeedbackSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSavedViews, newViewId, getViewSync } from "@/lib/feedback/storage";
import { computeCounts, computeScore } from "@/lib/feedback/heuristics";
import {
  SOURCE_LABELS,
  type ClassifiedFeedback,
  type SavedView,
  type Source,
  type Timeframe,
} from "@/lib/feedback/types";

type Props = {
  viewId?: string;
  keyword: string;
  sources: Source[];
  timeframe: Timeframe;
  initialView?: SavedView;
  autoFetch?: boolean;
};

export function FeedbackWorkspace({
  viewId,
  keyword,
  sources,
  timeframe,
  initialView,
  autoFetch = true,
}: Props) {
  const navigate = useNavigate();
  const { save } = useSavedViews();
  const fetchFn = useServerFn(fetchFeedback);
  const classifyFn = useServerFn(classifyFeedback);

  const [items, setItems] = useState<ClassifiedFeedback[]>(initialView?.items ?? []);
  const [history, setHistory] = useState(initialView?.history ?? []);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | undefined>(
    initialView?.lastFetchedAt,
  );
  const [errors, setErrors] = useState<Array<{ source: Source; message: string }>>([]);
  const [phase, setPhase] = useState<"idle" | "fetching" | "classifying">("idle");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState(keyword);

  const isSaved = !!viewId;

  const refresh = useMutation({
    mutationFn: async () => {
      setPhase("fetching");
      setErrors([]);
      const fetched = await fetchFn({
        data: { keyword, sources, timeframe, perSourceLimit: 8 },
      });
      setErrors(fetched.errors);
      if (fetched.items.length === 0) {
        setPhase("idle");
        return { items: [] as ClassifiedFeedback[] };
      }
      setPhase("classifying");
      const classified = await classifyFn({ data: { items: fetched.items } });
      setPhase("idle");
      return classified;
    },
    onSuccess: (data) => {
      const newItems = data.items;
      setItems(newItems);
      const now = new Date().toISOString();
      setLastFetchedAt(now);
      const counts = computeCounts(newItems);
      const score = computeScore(newItems);
      const newHistory = [...history, { fetchedAt: now, score, counts }].slice(-30);
      setHistory(newHistory);

      if (viewId) {
        // Auto-persist updates for saved views
        const existing = getViewSync(viewId);
        if (existing) {
          save({
            ...existing,
            items: newItems,
            history: newHistory,
            lastFetchedAt: now,
          });
        }
      }

      if (newItems.length === 0) {
        toast.warning("No results", {
          description: "Try a broader keyword or a longer timeframe.",
        });
      } else {
        toast.success(`Loaded ${newItems.length} feedback items`);
      }
    },
    onError: (err: unknown) => {
      setPhase("idle");
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("MISSING_FIRECRAWL_KEY")) {
        toast.error("Firecrawl is not connected", {
          description:
            "Open the connectors panel and link Firecrawl to start fetching feedback.",
          duration: 10000,
        });
      } else {
        toast.error("Fetch failed", { description: message });
      }
    },
  });

  // Auto-fetch on first mount (for fresh searches or opening a saved view)
  useEffect(() => {
    if (autoFetch && items.length === 0 && phase === "idle") {
      refresh.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = phase !== "idle";

  const status = useMemo(() => {
    if (phase === "fetching") return "Fetching from sources…";
    if (phase === "classifying") return "Classifying with AI…";
    if (lastFetchedAt)
      return `Updated ${formatDistanceToNow(new Date(lastFetchedAt), { addSuffix: true })}`;
    return "Ready";
  }, [phase, lastFetchedAt]);

  const handleSave = () => {
    const id = newViewId();
    const view: SavedView = {
      id,
      name: viewName.trim() || keyword,
      keyword,
      sources,
      timeframe,
      createdAt: new Date().toISOString(),
      lastFetchedAt,
      history,
      items,
    };
    save(view);
    setSaveDialogOpen(false);
    toast.success("View saved");
    navigate({ to: "/view/$viewId", params: { viewId: id } });
  };

  return (
    <div className="px-6 md:px-10 py-6 space-y-6">
      <header className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isSaved ? "Saved view" : "Ad-hoc search"}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 truncate max-w-2xl">
            {initialView?.name ?? keyword}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="size-3" />"{keyword}"
            </span>
            <span>·</span>
            <span>
              {sources.map((s) => SOURCE_LABELS[s]).join(" · ")}
            </span>
            <span>·</span>
            <span className="font-semibold text-primary-foreground bg-primary px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wide">
              Past {timeframe === "all" ? "All Time" : timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
            </span>
            <span>·</span>
            <span className={isLoading ? "text-foreground" : ""}>{status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh.mutate()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          {!isSaved && (
            <Button
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={items.length === 0}
            >
              <Save className="size-4 mr-2" /> Save view
            </Button>
          )}
        </div>
      </header>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              {errors.length} source{errors.length > 1 ? "s" : ""} failed
            </div>
            <ul className="mt-1 space-y-0.5">
              {errors.map((e) => (
                <li key={e.source}>
                  <strong className="capitalize">{SOURCE_LABELS[e.source]}:</strong> {e.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 grid place-items-center text-center">
          <Loader2 className="size-6 animate-spin mb-3 text-muted-foreground" />
          <div className="text-sm font-medium">{status}</div>
          <div className="text-xs text-muted-foreground mt-1">
            This usually takes 10–30 seconds depending on how many sources you selected.
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <div className="text-sm font-medium">No feedback found yet</div>
          <div className="text-xs text-muted-foreground mt-1">
            Try a broader keyword, more sources, or a longer timeframe.
          </div>
        </div>
      ) : (
        <>
          <Scorecard items={items} history={history} />
          <FeedbackSections items={items} />
        </>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>
              Name this saved view so you can find it in the sidebar. You can rename or delete
              it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save view</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
