import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Inbox, Plus, Trash2, Pencil, Check, X } from "lucide-react";

import { useSavedViews } from "@/lib/feedback/storage";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { computeScore } from "@/lib/feedback/heuristics";
import { formatDistanceToNow } from "date-fns";

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-emerald-100 text-emerald-700"
      : score >= 50
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tone}`}>{score}</span>
  );
}

export function AppSidebar() {
  const navigate = useNavigate();
  const { views, remove, rename } = useSavedViews();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center px-3 py-3">
          <img src="/voxpulse-logo.svg" alt="VoxPulse" className="h-7 w-auto" />
        </Link>
        <div className="px-2 pb-2">
          <Button asChild size="sm" className="w-full justify-start">
            <Link to="/">
              <Plus className="mr-2 size-4" /> New Search
            </Link>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Saved Views ({views.length})</SidebarGroupLabel>
          <SidebarGroupContent>
            {views.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground flex flex-col items-center text-center gap-2">
                <Inbox className="size-5 opacity-60" />
                <span>No Saved Views Yet. Run A Search And Save It.</span>
              </div>
            ) : (
              <SidebarMenu>
                {views.map((v) => {
                  const score = v.items.length ? computeScore(v.items) : 50;
                  const isEditing = editingId === v.id;
                  return (
                    <SidebarMenuItem key={v.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                rename(v.id, editName.trim() || v.name);
                                setEditingId(null);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            onClick={() => {
                              rename(v.id, editName.trim() || v.name);
                              setEditingId(null);
                            }}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group/item flex items-center w-full">
                          <SidebarMenuButton asChild className="flex-1">
                            <Link
                              to="/view/$viewId"
                              params={{ viewId: v.id }}
                              activeProps={{ className: "bg-sidebar-accent" }}
                            >
                              <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className="truncate text-sm font-normal">{v.name}</span>
                                  <ScorePill score={score} />
                                </div>
                                <span className="text-[10px] text-muted-foreground/70 truncate w-full">
                                  {v.lastFetchedAt
                                    ? `Updated ${formatDistanceToNow(new Date(v.lastFetchedAt), { addSuffix: true })}`
                                    : "Never fetched"}
                                </span>
                              </div>
                            </Link>
                          </SidebarMenuButton>
                          <div className="opacity-0 group-hover/item:opacity-100 flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingId(v.id);
                                setEditName(v.name);
                              }}
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-rose-500 hover:text-rose-600"
                              onClick={(e) => {
                                e.preventDefault();
                                setDeleteId(v.id);
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this view?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved view, its fetched feedback, and its sentiment history will be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  remove(deleteId);
                  navigate({ to: "/" });
                }
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
