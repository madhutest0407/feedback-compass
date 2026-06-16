# Switch data source from Firecrawl to Perplexity

Perplexity's Sonar API does live web search across Reddit, Twitter/X, G2, Capterra, and Trustpilot and returns structured JSON with citations — a clean replacement for Firecrawl's `site:` searches. Everything else in the app (classification, scorecard, saved views, UI) stays the same.

## What changes

### 1. Connector
- Replace the Firecrawl connector requirement with **Perplexity**.
- After approval, prompt to link the Perplexity connection, which injects `PERPLEXITY_API_KEY` server-side.

### 2. `src/lib/feedback/fetch.functions.ts` (rewrite)
- Replace Firecrawl SDK calls with `fetch('https://api.perplexity.ai/chat/completions')`.
- One request per source (Reddit, Twitter, G2, Capterra, Trustpilot) in parallel, each using:
  - `model: 'sonar'` (fast) — upgrade to `sonar-pro` only for low-volume keywords.
  - `search_domain_filter: ['reddit.com']` etc. to scope per source.
  - `search_recency_filter` mapped from the user's timeframe (`day` / `week` / `month` / `year`).
  - `response_format: json_schema` returning an array of `{ title, snippet, url, author?, date?, rating? }`.
- Normalize results to the existing `RawFeedback` shape; preserve per-source error isolation.
- Keep the same exported `fetchFeedback({ keyword, sources, timeframe })` signature so `search.tsx` and `view.$viewId.tsx` don't change.

### 3. Classification pipeline
- No changes. Heuristics + Lovable AI Gateway (Gemini Flash) for ambiguous items still works on the normalized items.

### 4. UI / storage / dashboard
- No changes. SearchBar, FeedbackSections, Scorecard, AppSidebar, `useSavedViews` all stay as-is.

## Technical notes

- Perplexity returns one synthesized answer + citations per call. The JSON-schema response makes it return a list of distinct feedback items grounded in those citations, which is what we want (vs. one summarized blob).
- `search_domain_filter` accepts up to 10 domains; we pass one per call to keep results clean and parallelize.
- If a source returns nothing or errors, that source is marked unavailable in the result; other sources still render.
- Quietly fix the SSR hydration error surfaced in the preview while touching the routes.

## Out of scope
- Official per-platform APIs (Reddit/Twitter/etc.)
- Auth, multi-user, exports — unchanged from prior plan.

## Build order
1. Rewrite `fetch.functions.ts` to use Perplexity.
2. Update plan doc + any Firecrawl references in UI copy ("Powered by …").
3. Smoke-test with a sample keyword end-to-end.
