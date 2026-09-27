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

  const openedAt = assignment.openedAt ? new Date(assignment.openedAt).getTime() : Date.now();
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
  const prior = Array.isArray(incomingEvents) ? (incomingEvents as ProtocolJudgmentEvent[]) : [];
  const events = [...prior, lockEvent];

  const contestantScores = {
    [battle.artistAId]: SCORE_CATEGORIES.reduce(
      (scorecard, category) => ({
        ...scorecard,
        [category.key]: Math.max(1, Math.round(((100 - sliders[category.key]) / 100) * 10)),
      }),
      {} as Record<ScoreKey, number>,
    ),
    [battle.artistBId]: SCORE_CATEGORIES.reduce(
      (scorecard, category) => ({
        ...scorecard,
        [category.key]: Math.max(1, Math.round((sliders[category.key] / 100) * 10)),
      }),
      {} as Record<ScoreKey, number>,
    ),
  };

  const judgment: ProtocolJudgment = {
    id: makeId(),
    assignmentId: assignment.id,
    battleId: battle.id,
    judgeArtistId: assignment.judgeArtistId,
    scores: contestantScores[decision.winnerArtistId],
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
