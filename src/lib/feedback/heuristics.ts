import type { ClassifiedFeedback, RawFeedback, Severity, Impact } from "./types";

const NEG_STRONG = [
  "terrible", "horrible", "awful", "worst", "scam", "fraud", "broken",
  "crash", "crashes", "crashed", "cancel", "cancelled", "canceling",
  "refund", "unusable", "garbage", "useless", "waste of money", "stay away",
  "do not buy", "do not use", "data loss", "lost data", "security",
];
const NEG_SOFT = [
  "bug", "buggy", "slow", "frustrating", "annoying", "disappointed",
  "issue", "problem", "missing", "lacking", "expensive", "overpriced",
  "hard to use", "confusing", "difficult", "complicated", "support is",
];
const POS_STRONG = [
  "love", "amazing", "excellent", "perfect", "fantastic", "best",
  "game changer", "life saver", "highly recommend", "couldn't be happier",
];
const POS_SOFT = [
  "great", "good", "nice", "happy", "recommend", "easy to use", "works well",
  "intuitive", "useful", "helpful", "solid",
];

function matches(text: string, list: string[]) {
  const lower = text.toLowerCase();
  return list.filter((w) => lower.includes(w));
}

function guessTheme(text: string): string {
  const lower = text.toLowerCase();
  const themes: Array<[string, string[]]> = [
    ["pricing", ["price", "pricing", "expensive", "cost", "billing", "subscription", "refund"]],
    ["onboarding", ["onboard", "setup", "getting started", "first time", "signup", "sign up"]],
    ["performance", ["slow", "fast", "lag", "performance", "speed", "loading"]],
    ["bugs", ["bug", "crash", "broken", "error", "glitch", "freeze"]],
    ["support", ["support", "customer service", "help desk", "response"]],
    ["UX", ["ui", "ux", "design", "interface", "confusing", "intuitive", "layout"]],
    ["features", ["feature", "missing", "lacks", "wish", "would love"]],
    ["reliability", ["downtime", "outage", "reliable", "stable", "unstable"]],
    ["integrations", ["integration", "api", "webhook", "connect", "import", "export"]],
  ];
  for (const [theme, kws] of themes) {
    if (kws.some((k) => lower.includes(k))) return theme;
  }
  return "general";
}

export function heuristicClassify(item: RawFeedback): ClassifiedFeedback | null {
  const text = `${item.title} ${item.snippet}`;
  const lower = text.toLowerCase();

  // Strong signal: explicit star rating
  if (typeof item.rating === "number") {
    if (item.rating <= 2) {
      const strong = matches(text, NEG_STRONG).length > 0;
      const severity: Severity = item.rating <= 1 || strong ? "critical" : "major";
      return {
        ...item,
        sentiment: "negative",
        severity,
        theme: guessTheme(text),
        reason: `Low rating (${item.rating}/5)${strong ? " + strong negative language" : ""}`,
        classifiedBy: "heuristic",
      };
    }
    if (item.rating >= 4) {
      const strong = matches(text, POS_STRONG).length > 0;
      const impact: Impact = item.rating === 5 && strong ? "high" : "low";
      return {
        ...item,
        sentiment: "positive",
        impact,
        theme: guessTheme(text),
        reason: `High rating (${item.rating}/5)${strong ? " + enthusiastic language" : ""}`,
        classifiedBy: "heuristic",
      };
    }
    return null; // 3 stars = ambiguous → AI
  }

  const negStrong = matches(text, NEG_STRONG);
  const negSoft = matches(text, NEG_SOFT);
  const posStrong = matches(text, POS_STRONG);
  const posSoft = matches(text, POS_SOFT);

  const negScore = negStrong.length * 2 + negSoft.length;
  const posScore = posStrong.length * 2 + posSoft.length;

  // Confident negative
  if (negScore >= 3 && negScore > posScore * 2) {
    let severity: Severity = "minor";
    if (negStrong.length >= 2) severity = "critical";
    else if (negStrong.length >= 1 || negSoft.length >= 3) severity = "major";
    return {
      ...item,
      sentiment: "negative",
      severity,
      theme: guessTheme(text),
      reason: `Negative language: ${[...negStrong, ...negSoft].slice(0, 3).join(", ")}`,
      classifiedBy: "heuristic",
    };
  }

  // Confident positive
  if (posScore >= 3 && posScore > negScore * 2) {
    const impact: Impact = posStrong.length >= 2 ? "high" : "low";
    return {
      ...item,
      sentiment: "positive",
      impact,
      theme: guessTheme(text),
      reason: `Positive language: ${[...posStrong, ...posSoft].slice(0, 3).join(", ")}`,
      classifiedBy: "heuristic",
    };
  }

  // Ambiguous → AI pass
  return null;
}

export function computeScore(items: ClassifiedFeedback[]): number {
  if (items.length === 0) return 50;
  let sum = 0;
  for (const it of items) {
    if (it.sentiment === "negative") {
      sum += it.severity === "critical" ? -3 : it.severity === "major" ? -2 : -1;
    } else if (it.sentiment === "positive") {
      sum += it.impact === "high" ? 3 : 1;
    }
  }
  // Normalize: max possible = items.length * 3, min = items.length * -3
  const max = items.length * 3;
  const normalized = ((sum + max) / (2 * max)) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

export function computeCounts(items: ClassifiedFeedback[]) {
  return {
    critical: items.filter((i) => i.sentiment === "negative" && i.severity === "critical").length,
    major: items.filter((i) => i.sentiment === "negative" && i.severity === "major").length,
    minor: items.filter((i) => i.sentiment === "negative" && i.severity === "minor").length,
    highImpact: items.filter((i) => i.sentiment === "positive" && i.impact === "high").length,
    lowImpact: items.filter((i) => i.sentiment === "positive" && i.impact === "low").length,
    total: items.length,
  };
}
