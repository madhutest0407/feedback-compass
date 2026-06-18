import { useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Check,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { fetchFeedback } from "@/lib/feedback/fetch.functions";
import { classifyFeedback } from "@/lib/feedback/classify.functions";
import { Scorecard } from "@/components/feedback/Scorecard";
import { FeedbackSections } from "@/components/feedback/FeedbackSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSavedViews, newViewId, getViewSync } from "@/lib/feedback/storage";
import { computeCounts, computeScore } from "@/lib/feedback/heuristics";
import {
  SOURCES,
  SOURCE_LABELS,
  TIMEFRAMES,
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

  // Active search params — may diverge from props after an edit
  const [activeViewName, setActiveViewName] = useState(initialView?.name ?? keyword);
  const [activeKeyword, setActiveKeyword] = useState(keyword);
  const [activeSources, setActiveSources] = useState<Source[]>(sources);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(timeframe);

  // Ref so the refresh mutationFn always reads the latest values without closure staleness
  const activeParamsRef = useRef({ keyword, sources, timeframe });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editKeyword, setEditKeyword] = useState("");
  const [editSources, setEditSources] = useState<Source[]>([]);
  const [editTimeframe, setEditTimeframe] = useState<Timeframe>("month");

  const isSaved = !!viewId;

  const refresh = useMutation({
    mutationFn: async () => {
      const { keyword: kw, sources: srcs, timeframe: tf } = activeParamsRef.current;
      setPhase("fetching");
      setErrors([]);
      const fetched = await fetchFn({
        data: { keyword: kw, sources: srcs, timeframe: tf, perSourceLimit: 8 },
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
        const existing = getViewSync(viewId);
        if (existing) {
          save({
            ...existing,
            keyword: activeParamsRef.current.keyword,
            sources: activeParamsRef.current.sources,
            timeframe: activeParamsRef.current.timeframe,
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

  // Auto-fetch on first mount
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

  const openEditDialog = () => {
    setEditName(activeViewName);
    setEditKeyword(activeKeyword);
    setEditSources([...activeSources]);
    setEditTimeframe(activeTimeframe);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!viewId || !editKeyword.trim() || editSources.length === 0) return;

    const newKeyword = editKeyword.trim();
    const newName = editName.trim() || activeViewName;

    // Update ref immediately so the refresh mutationFn uses the new values
    activeParamsRef.current = { keyword: newKeyword, sources: editSources, timeframe: editTimeframe };

    // Update display state
    setActiveViewName(newName);
    setActiveKeyword(newKeyword);
    setActiveSources(editSources);
    setActiveTimeframe(editTimeframe);

    // Persist the criteria change to localStorage (keep history + items intact)
    const existing = getViewSync(viewId);
    if (existing) {
      save({
        ...existing,
        name: newName,
        keyword: newKeyword,
        sources: editSources,
        timeframe: editTimeframe,
      });
    }

    setEditDialogOpen(false);
    toast.success("View updated — fetching with new criteria");
    refresh.mutate();
  };

  const toggleEditSource = (s: Source) =>
    setEditSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="px-6 md:px-10 py-6 space-y-6">
      <header className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isSaved ? "Saved View" : "Ad-Hoc Search"}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 truncate max-w-2xl">
            {activeViewName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="size-3" />&quot;{activeKeyword}&quot;
            </span>
            <span>·</span>
            <span>{activeSources.map((s) => SOURCE_LABELS[s]).join(" · ")}</span>
            <span>·</span>
            <span className="text-primary border border-primary/40 bg-primary/10 px-2 py-0.5 rounded-full text-xs">
              Past {activeTimeframe === "all" ? "All Time" : activeTimeframe.charAt(0).toUpperCase() + activeTimeframe.slice(1)}
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
          {isSaved && (
            <Button variant="outline" size="sm" onClick={openEditDialog} disabled={isLoading}>
              <Pencil className="size-4" />
              <span className="ml-2">Edit View</span>
            </Button>
          )}
          {!isSaved && (
            <Button
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={items.length === 0}
            >
              <Save className="size-4 mr-2" /> Save View
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
          <div className="text-sm font-medium">No Feedback Found Yet</div>
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

      {/* Save new view dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save This View</DialogTitle>
            <DialogDescription>
              Name this saved view so you can find it in the sidebar. You can edit or delete it later.
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
            <Button onClick={handleSave}>Save View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit saved view dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit View</DialogTitle>
            <DialogDescription>
              Update the name, keyword, sources, or timeframe. Your sentiment history will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* View name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                View Name
              </Label>
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="View name"
              />
            </div>

            {/* Keyword */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Keyword Or Product
              </Label>
              <Input
                value={editKeyword}
                onChange={(e) => setEditKeyword(e.target.value)}
                placeholder='e.g. "Notion onboarding", "Figma performance"'
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }}
              />
            </div>

            {/* Sources */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sources
              </Label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => {
                  const active = editSources.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleEditSource(s)}
                      className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all select-none ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90"
                          : "bg-muted text-muted-foreground border-border hover:border-primary hover:text-primary hover:bg-primary/10"
                      }`}
                    >
                      {active ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                      {SOURCE_LABELS[s]}
                    </button>
                  );
                })}
              </div>
              {editSources.length === 0 && (
                <p className="text-xs text-destructive">Select at least one source.</p>
              )}
            </div>

            {/* Timeframe */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Timeframe
              </Label>
              <Select value={editTimeframe} onValueChange={(v) => setEditTimeframe(v as Timeframe)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((t) => (
                    <SelectItem key={t} value={t}>
                      Past {t === "all" ? "All Time" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editKeyword.trim() || editSources.length === 0}
            >
              Save &amp; Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
