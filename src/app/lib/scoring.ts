import { SCORE_CATEGORIES, type ScoreKey } from "./scoreCategories";

export type SliderMap = Record<ScoreKey, number>;

export const SLIDER_EVEN = 50;

export function clampSlider(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return SLIDER_EVEN;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function evenSliders(): SliderMap {
  return SCORE_CATEGORIES.reduce((map, category) => {
    map[category.key] = SLIDER_EVEN;
    return map;
  }, {} as SliderMap);
}

export function normalizeSliders(input?: Partial<Record<ScoreKey, unknown>>): SliderMap {
  const next = evenSliders();
  if (!input) {
    return next;
  }

  for (const category of SCORE_CATEGORIES) {
    if (category.key in input) {
      next[category.key] = clampSlider(input[category.key]);
    }
  }

  return next;
}

export function aggregateFromSliders(sliders: SliderMap) {
  const normalized = normalizeSliders(sliders);
  const aPoints = SCORE_CATEGORIES.reduce((sum, category) => {
    return sum + (category.weight * (100 - normalized[category.key])) / 100;
  }, 0);

  const aPct = Math.round(aPoints);
  const bPct = 100 - aPct;

  return {
    sliders: normalized,
    aPoints,
    bPoints: 100 - aPoints,
    aPct,
    bPct,
    isTie: aPct === bPct,
  };
}

export function winnerFromAggregate(
  artistAId: string,
  artistBId: string,
  sliders: SliderMap,
) {
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

export const REVEAL_PHASES = [
  "SEALED",
  "GATES",
  "INTRO",
  "METER",
  "LOCK",
  "FINISHER",
  "OUTCOME",
  "REST",
] as const;

export type RevealPhase = (typeof REVEAL_PHASES)[number];

export const FINISHER_SCROLL_CRUSH = "scroll_crush";
export const FINISHER_02 = "finisher_02";
export const FINISHER_03 = "finisher_03";

export const DEFAULT_FINISHER = FINISHER_SCROLL_CRUSH;
