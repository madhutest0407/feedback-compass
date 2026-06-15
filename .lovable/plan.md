# Customer Feedback Viewer — Plan

A PM-facing tool that searches customer feedback across Reddit, Twitter/X, G2, Capterra, and Trustpilot for a given keyword, classifies and prioritizes it, and lets the user save views for quick re-fetching.

## 1. Core flows

1. **New search** — User enters a keyword (e.g. "Notion onboarding"), optionally filters sources and timeframe, hits Search.
2. **Results view** — Aggregated feedback grouped by sentiment priority + scorecard dashboard at the top.
3. **Save view** — User names + saves the current search. Saved views appear in a sidebar.
4. **Manage views** — Open (re-fetch latest), rename, delete. Last-fetched timestamp shown per view.

## 2. Pages / routes

```
src/routes/
  index.tsx              -> Landing: search bar + saved views sidebar + empty state
  view.$viewId.tsx       -> Saved view detail (auto-fetches latest on open)
  search.tsx             -> Ad-hoc search results (not yet saved)
```

## 3. Data fetching — Firecrawl

One server function `fetchFeedback({ keyword, sources, timeframe })` that runs Firecrawl searches in parallel, one per source, with `site:` filters:

- Reddit: `site:reddit.com {keyword}` (Firecrawl search + scrape markdown of top N)
- Twitter/X: `site:x.com OR site:twitter.com {keyword}`
- G2: `site:g2.com {keyword} review`
- Capterra: `site:capterra.com {keyword} review`
- Trustpilot: `site:trustpilot.com {keyword} review`

Each result normalized to:
```ts
{ id, source, url, title, snippet, author?, date?, rating?, raw }
```

Errors per source are isolated (one source failing doesn't kill the view). Firecrawl connector will be linked via the connector flow; surfaces a clear "Connect Firecrawl" CTA if missing.

## 4. Classification pipeline (hybrid)

Server function `classifyFeedback(items)`:

**Pass 1 — heuristics (free, instant):**
- Star rating (G2/Capterra/Trustpilot): 1-2 = critical-negative, 3 = ambiguous, 4-5 = positive.
- Negative keyword list (broken, terrible, bug, crash, cancel, refund, scam…) → negative.
- Positive keyword list (love, amazing, perfect, recommend…) → positive.
- Engagement signal (Reddit upvotes, retweet/like hints in snippet) → impact score.
- Items confidently classified are tagged and skipped.

**Pass 2 — Lovable AI (Gemini Flash) for ambiguous items only:**
Batched structured output with Zod schema:
```ts
{ sentiment: 'positive'|'negative'|'neutral',
  severity: 'critical'|'major'|'minor',   // negative only
  impact:   'high'|'low',                  // positive only
  theme: string,                           // short tag e.g. "pricing", "onboarding"
  reason: string }                         // 1-line justification
```

Results cached per (source+url) hash in localStorage so re-fetches only classify new items.

## 5. View layout

**Top — Scorecard dashboard (sticky):**
- Overall sentiment score 0–100 (weighted: critical -3, major -2, minor -1, low+1, high+3, normalized) + delta vs last fetch.
- Volume by source (bar) + by severity (donut).
- Top themes (AI-clustered tag cloud / list with counts).
- Sentiment-over-time line chart across all stored fetches of this view.

**Below — Prioritized feedback lists (tabs or stacked sections):**
1. Critical (red) — negative high severity
2. Major (orange)
3. Minor (yellow)
4. Positive — High impact (green)
5. Positive — Low impact (muted green)

Each item card: source badge, title/snippet, author, date, rating (if any), theme chips, AI reason, external link.

Filters: source multi-select, date range, theme chip filter, search-within-results.

## 6. Saved views (localStorage)

```ts
type SavedView = {
  id: string;
  name: string;
  keyword: string;
  sources: Source[];
  timeframe: 'day'|'week'|'month'|'year'|'all';
  createdAt: string;
  lastFetchedAt?: string;
  history: Array<{ fetchedAt: string; score: number; counts: {...} }>; // for trend chart
  items: ClassifiedFeedback[]; // latest snapshot
};
```

Stored under `feedback-viewer:views` via a small `useSavedViews` hook (CRUD + rename). Sidebar lists views with name, keyword, last-fetched, sentiment score pill. Actions: Open, Rename (inline), Delete (confirm), Duplicate.

## 7. State & data layer

- TanStack Query for the fetch+classify server fn (`['feedback', viewId or keyword]`).
- `ensureQueryData` in loaders; `useSuspenseQuery` in components.
- Mutation `refreshView` invalidates the query and appends to `history`.

## 8. Tech details (for the build phase)

- **Server functions** (`src/lib/feedback.functions.ts`):
  - `fetchFeedback({ keyword, sources, timeframe })` → raw normalized items (Firecrawl)
  - `classifyFeedback({ items, alreadyClassified })` → classified items (heuristics + Lovable AI Gemini Flash via AI Gateway)
- **Connectors**: Firecrawl (link via `standard_connectors--connect`); `LOVABLE_API_KEY` for AI.
- **UI**: shadcn — Card, Tabs, Badge, Tooltip, Dialog (rename/delete), Skeleton, Sidebar, Sonner toasts. Recharts for donut/bar/line.
- **No auth, no DB** — strictly client-side persistence as requested.

## 9. Out of scope (v1)

- Multi-user / sharing of views.
- Per-source official APIs (Reddit/Twitter) — Firecrawl only.
- Email/Slack alerts on new critical feedback.
- Export to CSV/PDF (easy to add later).

## 10. Build order

1. Routes shell + sidebar + landing search form.
2. Firecrawl connector wiring + `fetchFeedback` server fn (test with one source, then fan out).
3. Heuristic classifier + AI classifier + cache.
4. Results view: prioritized lists + filters.
5. Scorecard dashboard (score, charts, themes, trend).
6. Saved views CRUD (save, open, rename, delete) + history append on refresh.
7. Polish: empty states, error states per source, loading skeletons.
