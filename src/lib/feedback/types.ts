export const SOURCES = ["reddit", "twitter", "g2", "capterra", "trustpilot"] as const;
export type Source = (typeof SOURCES)[number];

export const TIMEFRAMES = ["day", "week", "month", "year", "all"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type RawFeedback = {
  id: string;
  source: Source;
  url: string;
  title: string;
  snippet: string;
  author?: string;
  date?: string;
  rating?: number;
};

export type Sentiment = "positive" | "negative" | "neutral";
export type Severity = "critical" | "major" | "minor";
export type Impact = "high" | "low";

export type ClassifiedFeedback = RawFeedback & {
  sentiment: Sentiment;
  severity?: Severity; // when negative
  impact?: Impact; // when positive
  theme: string;
  reason: string;
  classifiedBy: "heuristic" | "ai";
};

export type FetchHistoryPoint = {
  fetchedAt: string;
  score: number;
  counts: {
    critical: number;
    major: number;
    minor: number;
    highImpact: number;
    lowImpact: number;
    total: number;
  };
};

export type SavedView = {
  id: string;
  name: string;
  keyword: string;
  sources: Source[];
  timeframe: Timeframe;
  createdAt: string;
  lastFetchedAt?: string;
  history: FetchHistoryPoint[];
  items: ClassifiedFeedback[];
};

export const SOURCE_LABELS: Record<Source, string> = {
  reddit: "Reddit",
  twitter: "Twitter / X",
  g2: "G2",
  capterra: "Capterra",
  trustpilot: "Trustpilot",
};
