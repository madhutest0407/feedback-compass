import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { FeedbackWorkspace } from "@/components/feedback/FeedbackWorkspace";
import { getViewSync } from "@/lib/feedback/storage";
import type { SavedView } from "@/lib/feedback/types";

export const Route = createFileRoute("/view/$viewId")({
  head: () => ({
    meta: [
      { title: "Saved view — Feedback Viewer" },
      { name: "description", content: "A saved customer feedback view." },
    ],
  }),
  component: SavedViewPage,
});

function SavedViewPage() {
  const { viewId } = useParams({ from: "/view/$viewId" });
  // localStorage isn't available during SSR — load on client only
  const [view, setView] = useState<SavedView | null | undefined>(undefined);

  useEffect(() => {
    setView(getViewSync(viewId) ?? null);
  }, [viewId]);

  if (view === undefined) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="px-10 py-16 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-semibold">View not found</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This saved view doesn't exist (it may have been deleted, or you're on a different
          browser — saved views are stored locally).
        </p>
      </div>
    );
  }

  return (
    <FeedbackWorkspace
      key={view.id}
      viewId={view.id}
      keyword={view.keyword}
      sources={view.sources}
      timeframe={view.timeframe}
      initialView={view}
      autoFetch={!view.lastFetchedAt}
    />
  );
}
