import { SCORE_CATEGORIES, type ScoreKey } from "./scoreCategories";

export type DualScore = { a: number; b: number };
export type SliderMap = Record<ScoreKey, DualScore>;

export const SLIDER_EVEN = 0;

export function clampScore100(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function evenSliders(): SliderMap {
  return SCORE_CATEGORIES.reduce((map, category) => {
    map[category.key] = { a: 0, b: 0 };
    return map;
  }, {} as SliderMap);
}

function asDual(raw: unknown): DualScore {
  if (raw && typeof raw === "object" && ("a" in (raw as object) || "b" in (raw as object))) {
    const dual = raw as DualScore;
    return { a: clampScore100(dual.a), b: clampScore100(dual.b) };
  }

  if (typeof raw === "number") {
    const value = clampScore100(raw);
    return {
      a: Math.max(0, (50 - value) * 2),
      b: Math.max(0, (value - 50) * 2),
    };
  }

  return { a: 0, b: 0 };
}

export function normalizeSliders(input?: Partial<Record<ScoreKey, unknown>>): SliderMap {
  const next = evenSliders();
  if (!input) {
    return next;
  }

  for (const category of SCORE_CATEGORIES) {
    if (category.key in input) {
      next[category.key] = asDual(input[category.key]);
    }
  }

  return next;
}

export function aggregateFromSliders(sliders: SliderMap | Record<string, unknown>) {
  const normalized = normalizeSliders(sliders as Partial<Record<ScoreKey, unknown>>);
  const aPoints = SCORE_CATEGORIES.reduce((sum, category) => {
    return sum + (category.weight * normalized[category.key].a) / 100;
  }, 0);
  const bPoints = SCORE_CATEGORIES.reduce((sum, category) => {
    return sum + (category.weight * normalized[category.key].b) / 100;
  }, 0);

  const aPct = Math.round(aPoints);
  const bPct = Math.round(bPoints);

  return {
    sliders: normalized,
    aPoints,
    bPoints,
    aPct,
    bPct,
    isTie: aPct === bPct,
  };
}

export function winnerFromAggregate(artistAId: string, artistBId: string, sliders: SliderMap | Record<string, unknown>) {
  const aggregate = aggregateFromSliders(sliders);
  if (aggregate.isTie) {
    return { ...aggregate, winnerArtistId: null as string | null };
  }

  return {
    ...aggregate,
    winnerArtistId: aggregate.aPct > aggregate.bPct ? artistAId : artistBId,
  };
}

export type JudgmentEventType = "open" | "slider" | "lock";

export type JudgmentEvent = {
  id: string;
  battleId: string;
  assignmentId: string;
  tMs: number;
  type: JudgmentEventType;
  category?: ScoreKey;
  sliders: SliderMap;
  aPct: number;
  bPct: number;
};

export const REVEAL_PHASES = ["SEALED", "GATES", "INTRO", "METER", "LOCK", "FINISHER", "OUTCOME", "REST"] as const;
export type RevealPhase = (typeof REVEAL_PHASES)[number];
export const FINISHER_SCROLL_CRUSH = "scroll_crush";
export const FINISHER_02 = "finisher_02";
export const FINISHER_03 = "finisher_03";
export const DEFAULT_FINISHER = FINISHER_SCROLL_CRUSH;
