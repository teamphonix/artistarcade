export const SCORE_CATEGORIES = [
  { key: "lyrics", label: "Lyrics", weight: 25 },
  { key: "delivery", label: "Delivery", weight: 20 },
  { key: "originality", label: "Originality", weight: 20 },
  { key: "flow", label: "Flow", weight: 15 },
  { key: "impact", label: "Impact", weight: 20 },
] as const;

export type ScoreKey = (typeof SCORE_CATEGORIES)[number]["key"];
