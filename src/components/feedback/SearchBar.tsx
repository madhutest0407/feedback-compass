import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SOURCES,
  SOURCE_LABELS,
  TIMEFRAMES,
  type Source,
  type Timeframe,
} from "@/lib/feedback/types";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [sources, setSources] = useState<Source[]>([...SOURCES]);
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [submitting, setSubmitting] = useState(false);

  const toggle = (s: Source) =>
    setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || sources.length === 0) return;
    setSubmitting(true);
    navigate({
      to: "/search",
      search: {
        q: keyword.trim(),
        sources: sources.join(","),
        tf: timeframe,
      },
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-2xl bg-card p-5 md:p-6 shadow-sm space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="kw" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Keyword Or Product
        </Label>
        <div className="flex gap-2">
          <Input
            id="kw"
            autoFocus={autoFocus}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder='e.g. "Notion onboarding", "Linear pricing", "Figma performance"'
            className="h-12 text-base"
          />
          <Button type="submit" size="lg" disabled={submitting || !keyword.trim() || sources.length === 0}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            <span className="ml-2">Search</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sources
          </Label>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => {
              const checked = sources.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggle(s)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                    checked
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <Checkbox checked={checked} className="size-3.5 pointer-events-none" />
                  {SOURCE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 md:w-44">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Timeframe
          </Label>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem key={t} value={t}>
                  Past {t === "all" ? "all time" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </form>
  );
}
