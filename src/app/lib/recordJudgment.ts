import { makeId, SCORE_CATEGORIES, type ProtocolAssignment, type ProtocolBattle, type ProtocolJudgment, type ProtocolJudgmentEvent, type ProtocolState, type ScoreKey } from "./pilotStore";
import { normalizeSliders, winnerFromAggregate, type SliderMap } from "./scoring";

export function recordSliderJudgment(
  state: ProtocolState,
  assignment: ProtocolAssignment,
  battle: ProtocolBattle,
  rawSliders: unknown,
  incomingEvents: unknown,
) {
  const sliders = normalizeSliders((rawSliders || {}) as Partial<SliderMap>);
  const decision = winnerFromAggregate(battle.artistAId, battle.artistBId, sliders);

  if (decision.isTie || !decision.winnerArtistId) {
    return { error: "Fate cannot lock at 50/50. Move at least one slider.", status: 409 as const };
  }

  const openedAt = Date.parse(assignment.openedAt || assignment.assignedAt);
  const lockEvent: ProtocolJudgmentEvent = {
    id: makeId(),
    battleId: battle.id,
    assignmentId: assignment.id,
    tMs: Math.max(0, Date.now() - openedAt),
    type: "lock",
    sliders,
    aPct: decision.aPct,
    bPct: decision.bPct,
  };
  const prior: ProtocolJudgmentEvent[] = Array.isArray(incomingEvents) ? incomingEvents.slice(-300).flatMap((raw) => {
    if (!raw || typeof raw !== "object" || !["open", "slider"].includes(raw.type) || !Number.isFinite(raw.tMs)) return [];
    const snapshot = normalizeSliders(raw.sliders);
    const aggregate = winnerFromAggregate(battle.artistAId, battle.artistBId, snapshot);
    return [{ id: makeId(), battleId: battle.id, assignmentId: assignment.id,
      tMs: Math.min(lockEvent.tMs, Math.max(0, raw.tMs)), type: raw.type as "open" | "slider",
      ...(SCORE_CATEGORIES.some(({ key }) => key === raw.category) ? { category: raw.category as ScoreKey } : {}),
      sliders: snapshot, aPct: aggregate.aPct, bPct: aggregate.bPct }];
  }) : [];
  const events = [...prior, lockEvent];

  const contestantScores = {
    [battle.artistAId]: SCORE_CATEGORIES.reduce(
      (scorecard, category) => ({
        ...scorecard,
        [category.key]: sliders[category.key].a / 10,
      }),
      {} as Record<ScoreKey, number>,
    ),
    [battle.artistBId]: SCORE_CATEGORIES.reduce(
      (scorecard, category) => ({
        ...scorecard,
        [category.key]: sliders[category.key].b / 10,
      }),
      {} as Record<ScoreKey, number>,
    ),
  };

  const judgment: ProtocolJudgment = {
    id: makeId(),
    assignmentId: assignment.id,
    battleId: battle.id,
    judgeArtistId: assignment.judgeArtistId,
    scores: Object.fromEntries(SCORE_CATEGORIES.map(({ key }) => [key, Math.max(1, Math.round(contestantScores[decision.winnerArtistId!][key]))])) as Record<ScoreKey, number>,
    contestantScores,
    sliders,
    events,
    selectedWinnerArtistId: decision.winnerArtistId,
    createdAt: new Date().toISOString(),
  };

  state.judgments = state.judgments.filter((entry) => entry.assignmentId !== assignment.id);
  state.judgments.push(judgment);
  state.judgmentEvents = [...(state.judgmentEvents || []).filter((entry) => entry.assignmentId !== assignment.id), ...events];

  return {
    judgment,
    sliders,
    decision,
    events,
    selectedWinnerArtistId: decision.winnerArtistId,
  };
}
