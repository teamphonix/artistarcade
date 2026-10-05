import { randomInt } from "node:crypto";
import { makeId, type ProtocolState } from "./pilotStore";

export const WAVE_MS = 16 * 60_000;
export const JUDGING_MS = 15 * 60_000;
export const PILOT_MS = 4 * WAVE_MS;

type RandomIndex = (size: number) => number;

function audit(state: ProtocolState, action: string, at: number, metadata: Record<string, unknown>, eventId: string | null = null, artistId: string | null = null) {
  state.auditLog.push({ id: makeId(), action, note: action.replaceAll("_", " "), eventId, artistId, metadata, createdAt: new Date(at).toISOString() });
}

export function pilotClock(state: ProtocolState) {
  const start = state.auditLog.find((entry) => entry.action === "pilot_started");
  if (!start) return null;
  const startedAt = Date.parse(start.createdAt);
  return { startedAt, revealAt: startedAt + PILOT_MS, revealed: state.auditLog.some((entry) => entry.action === "pilot_revealed") };
}

export function missedDuty(state: ProtocolState, artistId: string) {
  return state.assignments.some((entry) => entry.judgeArtistId === artistId && entry.status === "expired");
}

function shuffled<T>(items: T[], pick: RandomIndex) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createBattles(state: ProtocolState, eventId: string, round: number, ids: string[], at: number) {
  for (let i = 0; i < ids.length; i += 2) {
    state.battles.push({ id: makeId(), eventId, round, slot: i / 2 + 1, artistAId: ids[i], artistBId: ids[i + 1], status: "pending", winnerArtistId: null, createdAt: new Date(at).toISOString(), completedAt: null });
  }
}

function distribute(state: ProtocolState, round: number, at: number, pick: RandomIndex) {
  const participantIds = new Set(state.entries.map((entry) => entry.artistId));
  const used = new Set<string>();
  for (const battle of shuffled(state.battles.filter((entry) => entry.round === round), pick)) {
    const ownEvent = new Set(state.entries.filter((entry) => entry.eventId === battle.eventId).map((entry) => entry.artistId));
    const candidates = state.artists.filter((artist) => participantIds.has(artist.id) && !ownEvent.has(artist.id) && !used.has(artist.id) && !missedDuty(state, artist.id)
      && !state.assignments.some((entry) => entry.judgeArtistId === artist.id && ["assigned", "opened"].includes(entry.status))
      && !state.assignments.some((entry) => {
        const prior = state.battles.find((card) => card.id === entry.battleId);
        return entry.judgeArtistId === artist.id && prior && prior.round < round && [prior.artistAId, prior.artistBId].some((id) => id === battle.artistAId || id === battle.artistBId);
      }));
    const judge = candidates.length ? candidates[pick(candidates.length)] : null;
    battle.status = "judging";
    if (judge) {
      used.add(judge.id);
      state.assignments.push({ id: makeId(), battleId: battle.id, judgeArtistId: judge.id, status: "assigned", assignedAt: new Date(at).toISOString(), openedAt: null, dueAt: new Date(at + JUDGING_MS).toISOString(), completedAt: null });
      audit(state, "judge_assigned", at, { battleId: battle.id, round, dueAt: new Date(at + JUDGING_MS).toISOString() }, battle.eventId, judge.id);
    }
  }
  for (const event of state.events) {
    event.currentRound = round;
    event.phase = "judging";
    event.judgingDeadline = new Date(at + JUDGING_MS).toISOString();
  }
  audit(state, "pilot_wave_distributed", at, { round });
}

function resolveWave(state: ProtocolState, round: number, at: number, pick: RandomIndex) {
  const battles = state.battles.filter((entry) => entry.round === round);
  // Expire all missing duties before choosing ANY winners, so event order cannot affect eligibility.
  for (const assignment of state.assignments.filter((entry) => battles.some((battle) => battle.id === entry.battleId))) {
    const judgment = state.judgments.find((entry) => entry.assignmentId === assignment.id && entry.battleId === assignment.battleId && entry.judgeArtistId === assignment.judgeArtistId
      && Date.parse(entry.createdAt) >= Date.parse(assignment.assignedAt) && Date.parse(entry.createdAt) < at);
    if (assignment.status !== "completed" || !judgment) {
      assignment.status = "expired";
      audit(state, "judging_expired", at, { assignmentId: assignment.id, battleId: assignment.battleId }, null, assignment.judgeArtistId);
    }
  }
  for (const battle of battles) {
    const assignment = state.assignments.find((entry) => entry.battleId === battle.id && entry.status === "completed");
    const judgment = assignment && state.judgments.find((entry) => entry.assignmentId === assignment.id);
    const ids = [battle.artistAId, battle.artistBId];
    const eligible = ids.filter((id) => !missedDuty(state, id));
    let method = "fatekeeper";
    let winner = judgment && ids.includes(judgment.selectedWinnerArtistId) ? judgment.selectedWinnerArtistId : null;
    if (eligible.length === 1) { winner = eligible[0]; method = "duty_forfeit"; }
    else if (!winner) { winner = ids[pick(2)]; method = "random_no_judgment"; }
    battle.winnerArtistId = winner;
    battle.status = "complete";
    battle.completedAt = new Date(at).toISOString();
    audit(state, "battle_resolved", at, { battleId: battle.id, round, method, winnerArtistId: winner, noEligibleContender: eligible.length === 0 }, battle.eventId);
  }
  audit(state, "pilot_wave_resolved", at, { round });
}

function reveal(state: ProtocolState, at: number) {
  for (const event of state.events) {
    const final = state.battles.find((battle) => battle.eventId === event.id && battle.round === 4);
    const winnerId = final?.winnerArtistId;
    const winner = state.artists.find((artist) => artist.id === winnerId);
    const eligible = winner && !missedDuty(state, winner.id);
    event.phase = "complete";
    event.judgingDeadline = null;
    event.winnerArtistId = eligible ? winner.id : null;
    for (const entry of state.entries.filter((entry) => entry.eventId === event.id)) {
      entry.status = eligible && entry.artistId === winner.id ? "winner" : "eliminated";
      const artist = state.artists.find((item) => item.id === entry.artistId);
      if (artist) artist.status = entry.status;
    }
    if (!eligible) { audit(state, "event_no_eligible_winner", at, {}, event.id); continue; }
    const gross = state.entries.filter((entry) => entry.eventId === event.id).reduce((sum, entry) => sum + entry.paidCents, 0);
    if (!Number.isSafeInteger(event.desiredPrizeCents) || event.desiredPrizeCents < 0 || gross < event.desiredPrizeCents) {
      audit(state, "settlement_hold", at, { grossCents: gross, prizeCents: event.desiredPrizeCents }, event.id, winner.id);
      continue;
    }
    if (!state.walletLedger.some((entry) => entry.eventId === event.id && entry.type === "prize")) {
      winner.walletCents += event.desiredPrizeCents;
      winner.rewardCents += event.desiredPrizeCents;
      event.companyRevenueCents = gross - event.desiredPrizeCents;
      state.walletLedger.push({ id: makeId(), artistId: winner.id, eventId: event.id, amountCents: event.desiredPrizeCents, type: "prize", note: `Winner prize for ${event.title}`, createdAt: new Date(at).toISOString() });
      state.walletLedger.push({ id: makeId(), artistId: null, eventId: event.id, amountCents: event.companyRevenueCents, type: "company_revenue", note: `Company remainder for ${event.title}`, createdAt: new Date(at).toISOString() });
    }
  }
  audit(state, "pilot_revealed", at, {});
}

/** Advances a persisted snapshot. The caller MUST serialize and atomically commit it before use with real USD. */
export function advancePilot(state: ProtocolState, now = Date.now(), pick: RandomIndex = randomInt) {
  state.auditLog ||= [];
  let clock = pilotClock(state);
  let changed = false;
  if (!clock) {
    const ids = state.entries.map((entry) => entry.artistId);
    if (state.events.length !== 4 || ids.length !== 64 || new Set(ids).size !== 64
      || state.events.some((event) => event.phase !== "submission" || event.currentRound !== 1 || (event.queueClosedAt && Date.parse(event.queueClosedAt) > now)
        || state.entries.filter((entry) => entry.eventId === event.id).length !== 16)
      || state.entries.some((entry) => !state.submissions.some((track) => track.artistId === entry.artistId && track.eventId === entry.eventId && track.round === 1))) return false;
    for (const event of state.events) {
      if (!state.battles.some((battle) => battle.eventId === event.id)) {
        createBattles(state, event.id, 1, state.entries.filter((entry) => entry.eventId === event.id).sort((a, b) => a.seed - b.seed).map((entry) => entry.artistId), now);
      }
      event.submissionDeadline = null;
    }
    audit(state, "pilot_started", now, { rulesVersion: "64-player-four-waves-v1", revealAt: new Date(now + PILOT_MS).toISOString() });
    distribute(state, 1, now, pick);
    clock = pilotClock(state)!;
    changed = true;
  }
  if (clock.revealed) return changed;
  for (let round = 1; round <= 4; round++) {
    const start = clock.startedAt + (round - 1) * WAVE_MS;
    const distributed = state.auditLog.some((entry) => entry.action === "pilot_wave_distributed" && entry.metadata.round === round);
    if (!distributed && now >= start) {
      for (const event of state.events) {
        const ids = state.battles.filter((battle) => battle.eventId === event.id && battle.round === round - 1).sort((a, b) => a.slot - b.slot).map((battle) => battle.winnerArtistId!);
        createBattles(state, event.id, round, ids, start);
      }
      distribute(state, round, start, pick);
      changed = true;
    }
    if (now >= start + JUDGING_MS && !state.auditLog.some((entry) => entry.action === "pilot_wave_resolved" && entry.metadata.round === round)) {
      resolveWave(state, round, start + JUDGING_MS, pick);
      changed = true;
    }
    if (now < start + WAVE_MS) break;
  }
  if (now >= clock.revealAt) { reveal(state, clock.revealAt); changed = true; }
  return changed;
}
