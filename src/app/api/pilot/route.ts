import { NextResponse } from "next/server";
import {
  ARTISTS_PER_EVENT,
  JUDGES_PER_BATTLE,
  JUDGING_WINDOW_MINUTES,
  SCORE_CATEGORIES,
  SUBMISSION_LIMIT_SECONDS,
  SUBMISSION_WINDOW_HOURS,
  clampScore,
  eventStandings,
  getEventEntries,
  makeId,
  readPilotState,
  resetPilotState,
  scoreBattle,
  writePilotState,
  type ProtocolBattle,
  type ProtocolEntry,
  type ProtocolJudgment,
  type ProtocolState,
  type ScoreKey,
} from "@/app/lib/pilotStore";
import { isValidEmail } from "@/app/lib/protocol";

type ProtocolAction =
  | "deposit"
  | "joinEvent"
  | "closeQueue"
  | "submit"
  | "generateJudgeAssignments"
  | "openAssignment"
  | "judge"
  | "finalizeRound"
  | "reset";

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next.toISOString();
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

function summarize(state: ProtocolState) {
  const events = state.events.map((event) => {
    const entries = getEventEntries(state, event.id);
    const battles = state.battles.filter((battle) => battle.eventId === event.id);
    const assignments = state.assignments.filter((assignment) =>
      battles.some((battle) => battle.id === assignment.battleId),
    );

    return {
      ...event,
      queuedCount: entries.length,
      openSlots: ARTISTS_PER_EVENT - entries.length,
      grossPotCents: entries.reduce((sum, entry) => sum + entry.paidCents, 0),
      projectedCompanyCents: Math.max(0, entries.reduce((sum, entry) => sum + entry.paidCents, 0) - event.desiredPrizeCents),
      entries,
      standings: eventStandings(state, event.id),
      battles,
      assignmentsTotal: assignments.length,
      assignmentsCompleted: assignments.filter((assignment) => assignment.status === "completed").length,
    };
  });

  const scoredBattles = state.battles.map((battle) => scoreBattle(state, battle.id)).filter(Boolean);

  return {
    settings: state.settings,
    artists: state.artists,
    events,
    submissions: state.submissions,
    battles: state.battles,
    assignments: state.assignments,
    judgments: state.judgments,
    walletLedger: state.walletLedger,
    scoredBattles,
    scoreCategories: SCORE_CATEGORIES,
    totals: {
      artists: state.artists.length,
      events: state.events.length,
      eventCapacity: state.events.length * ARTISTS_PER_EVENT,
      entries: state.entries.length,
      submissions: state.submissions.length,
      totalBattlesFullBracket: state.events.length * (ARTISTS_PER_EVENT - 1),
      activeBattles: state.battles.filter((battle) => battle.status !== "complete").length,
      completedBattles: state.battles.filter((battle) => battle.status === "complete").length,
      assignments: state.assignments.length,
      completedAssignments: state.assignments.filter((assignment) => assignment.status === "completed").length,
      companyRevenueCents: state.events.reduce((sum, event) => sum + event.companyRevenueCents, 0),
    },
    backend: "local",
  };
}

function createRoundBattles(state: ProtocolState, eventId: string, round: number, artistIds: string[]) {
  const now = new Date().toISOString();
  const createdBattles: ProtocolBattle[] = [];

  for (let index = 0; index < artistIds.length; index += 2) {
    const artistAId = artistIds[index];
    const artistBId = artistIds[index + 1];

    if (!artistAId || !artistBId) {
      continue;
    }

    const exists = state.battles.some(
      (battle) =>
        battle.eventId === eventId &&
        battle.round === round &&
        ((battle.artistAId === artistAId && battle.artistBId === artistBId) ||
          (battle.artistAId === artistBId && battle.artistBId === artistAId)),
    );

    if (!exists) {
      createdBattles.push({
        id: makeId("battle"),
        eventId,
        round,
        slot: Math.floor(index / 2) + 1,
        artistAId,
        artistBId,
        status: "pending",
        winnerArtistId: null,
        createdAt: now,
        completedAt: null,
      });
    }
  }

  state.battles.push(...createdBattles);
}

function eligibleJudges(state: ProtocolState, battle: ProtocolBattle) {
  const battleEventEntryIds = state.entries
    .filter((entry) => entry.eventId === battle.eventId)
    .map((entry) => entry.artistId);

  return state.artists.filter((artist) => {
    if (artist.id === battle.artistAId || artist.id === battle.artistBId) {
      return false;
    }

    return !battleEventEntryIds.includes(artist.id);
  });
}

function maybeCompleteBattle(state: ProtocolState, battleId: string) {
  const battle = state.battles.find((entry) => entry.id === battleId);
  if (!battle) {
    return;
  }

  const completedAssignments = state.assignments.filter(
    (assignment) => assignment.battleId === battleId && assignment.status === "completed",
  );

  if (completedAssignments.length < JUDGES_PER_BATTLE) {
    return;
  }

  const scored = scoreBattle(state, battleId);
  if (!scored?.winnerArtistId) {
    return;
  }

  battle.winnerArtistId = scored.winnerArtistId;
  battle.status = "complete";
  battle.completedAt = new Date().toISOString();

  const loserId = battle.artistAId === scored.winnerArtistId ? battle.artistBId : battle.artistAId;
  const winner = state.artists.find((artist) => artist.id === scored.winnerArtistId);
  const loser = state.artists.find((artist) => artist.id === loserId);
  const loserEntry = state.entries.find((entry) => entry.eventId === battle.eventId && entry.artistId === loserId);

  if (winner) {
    winner.status = "advanced";
  }

  if (loser) {
    loser.status = "eliminated";
  }

  if (loserEntry) {
    loserEntry.status = "eliminated";
  }
}

async function readPayload() {
  const state = await readPilotState();
  return summarize(state);
}

export async function GET() {
  try {
    return NextResponse.json(await readPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Protocol read failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action as ProtocolAction | undefined;

  if (!action) {
    return NextResponse.json({ error: "Missing protocol action." }, { status: 400 });
  }

  if (action === "reset") {
    await resetPilotState();
    return NextResponse.json(await readPayload());
  }

  const state = await readPilotState();

  try {
    if (action === "deposit") {
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();
      const amountCents = Math.max(0, Math.round(Number(body?.amountCents || 0)));

      if (name.length < 2 || !isValidEmail(email) || amountCents < 100) {
        return NextResponse.json({ error: "Name, valid email, and deposit amount are required." }, { status: 400 });
      }

      let artist = state.artists.find((entry) => entry.email === email);
      if (!artist) {
        artist = {
          id: makeId("artist"),
          name,
          email,
          walletCents: 0,
          rewardCents: 0,
          status: "registered",
          createdAt: new Date().toISOString(),
        };
        state.artists.push(artist);
      }

      artist.name = name;
      artist.walletCents += amountCents;
      state.walletLedger.push({
        id: makeId("ledger"),
        artistId: artist.id,
        eventId: null,
        amountCents,
        type: "deposit",
        note: "Wallet deposit",
        createdAt: new Date().toISOString(),
      });
    }

    if (action === "joinEvent") {
      const artistId = String(body?.artistId || "");
      const eventId = String(body?.eventId || "");
      const artist = state.artists.find((entry) => entry.id === artistId);
      const event = state.events.find((entry) => entry.id === eventId);

      if (!artist || !event) {
        return NextResponse.json({ error: "Artist and event are required." }, { status: 400 });
      }

      const eventEntries = state.entries.filter((entry) => entry.eventId === eventId);
      if (event.phase !== "queue") {
        return NextResponse.json({ error: "This event queue is closed." }, { status: 409 });
      }

      if (eventEntries.length >= ARTISTS_PER_EVENT) {
        return NextResponse.json({ error: "This event already has 16 artists." }, { status: 409 });
      }

      if (state.entries.some((entry) => entry.artistId === artistId)) {
        return NextResponse.json({ error: "Artist is already queued in an MVP event." }, { status: 409 });
      }

      if (artist.walletCents < event.entryFeeCents) {
        return NextResponse.json({ error: "Artist wallet does not have enough funds." }, { status: 409 });
      }

      artist.walletCents -= event.entryFeeCents;
      artist.status = "queued";
      const nextEntry: ProtocolEntry = {
        id: makeId("entry"),
        eventId,
        artistId,
        seed: eventEntries.length + 1,
        paidCents: event.entryFeeCents,
        status: "queued",
        joinedAt: new Date().toISOString(),
      };

      state.entries.push(nextEntry);
      state.walletLedger.push({
        id: makeId("ledger"),
        artistId,
        eventId,
        amountCents: -event.entryFeeCents,
        type: "entry_fee",
        note: `Entry fee for ${event.title}`,
        createdAt: new Date().toISOString(),
      });
    }

    if (action === "closeQueue") {
      const eventId = String(body?.eventId || "");
      const event = state.events.find((entry) => entry.id === eventId);
      const entries = state.entries.filter((entry) => entry.eventId === eventId).sort((a, b) => a.seed - b.seed);

      if (!event) {
        return NextResponse.json({ error: "Event is required." }, { status: 400 });
      }

      if (entries.length !== ARTISTS_PER_EVENT) {
        return NextResponse.json({ error: "Queue needs exactly 16 artists before it closes." }, { status: 409 });
      }

      event.phase = "submission";
      event.queueClosedAt = new Date().toISOString();
      event.submissionDeadline = addHours(new Date(), SUBMISSION_WINDOW_HOURS);
      entries.forEach((entry) => {
        entry.status = "active";
      });
      createRoundBattles(
        state,
        event.id,
        1,
        entries.map((entry) => entry.artistId),
      );
    }

    if (action === "submit") {
      const artistId = String(body?.artistId || "");
      const eventId = String(body?.eventId || "");
      const title = String(body?.title || "").trim();
      const audioUrl = String(body?.audioUrl || "").trim();
      const durationSeconds = Math.round(Number(body?.durationSeconds || 0));
      const event = state.events.find((entry) => entry.id === eventId);
      const entry = state.entries.find((eventEntry) => eventEntry.eventId === eventId && eventEntry.artistId === artistId);

      if (!event || !entry || title.length < 2 || !audioUrl) {
        return NextResponse.json({ error: "Event, artist, title, and audio link are required." }, { status: 400 });
      }

      if (durationSeconds < 1 || durationSeconds > SUBMISSION_LIMIT_SECONDS) {
        return NextResponse.json({ error: "Submission must be 3 minutes or less." }, { status: 409 });
      }

      const existing = state.submissions.find(
        (submission) => submission.eventId === eventId && submission.artistId === artistId && submission.round === event.currentRound,
      );

      const nextSubmission = {
        id: existing?.id || makeId("sub"),
        eventId,
        artistId,
        round: event.currentRound,
        title,
        audioUrl,
        durationSeconds,
        submittedAt: existing?.submittedAt || new Date().toISOString(),
      };

      state.submissions = state.submissions.filter((submission) => submission.id !== existing?.id);
      state.submissions.push(nextSubmission);
      const artist = state.artists.find((entryArtist) => entryArtist.id === artistId);
      if (artist) {
        artist.status = "submitted";
      }
    }

    if (action === "generateJudgeAssignments") {
      const eventId = String(body?.eventId || "");
      const event = state.events.find((entry) => entry.id === eventId);

      if (!event) {
        return NextResponse.json({ error: "Event is required." }, { status: 400 });
      }

      const roundBattles = state.battles.filter(
        (battle) => battle.eventId === event.id && battle.round === event.currentRound && battle.status !== "complete",
      );

      roundBattles.forEach((battle) => {
        const existingAssignments = state.assignments.filter((assignment) => assignment.battleId === battle.id);
        const judges = eligibleJudges(state, battle)
          .filter((artist) => !existingAssignments.some((assignment) => assignment.judgeArtistId === artist.id))
          .slice(0, JUDGES_PER_BATTLE - existingAssignments.length);

        judges.forEach((judge) => {
          state.assignments.push({
            id: makeId("assign"),
            battleId: battle.id,
            judgeArtistId: judge.id,
            status: "assigned",
            assignedAt: new Date().toISOString(),
            openedAt: null,
            dueAt: null,
            completedAt: null,
          });
        });

        battle.status = "judging";
      });

      event.phase = "judging";
      event.judgingDeadline = addHours(new Date(), 24);
    }

    if (action === "openAssignment") {
      const assignmentId = String(body?.assignmentId || "");
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);

      if (!assignment) {
        return NextResponse.json({ error: "Assignment is required." }, { status: 400 });
      }

      if (assignment.status === "assigned") {
        assignment.status = "opened";
        assignment.openedAt = new Date().toISOString();
        assignment.dueAt = addMinutes(new Date(), JUDGING_WINDOW_MINUTES);
      }
    }

    if (action === "judge") {
      const assignmentId = String(body?.assignmentId || "");
      const selectedWinnerArtistId = String(body?.selectedWinnerArtistId || "");
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);

      if (!assignment) {
        return NextResponse.json({ error: "Assignment is required." }, { status: 400 });
      }

      const battle = state.battles.find((entry) => entry.id === assignment.battleId);
      if (!battle || ![battle.artistAId, battle.artistBId].includes(selectedWinnerArtistId)) {
        return NextResponse.json({ error: "Battle winner selection is invalid." }, { status: 400 });
      }

      if (assignment.dueAt && new Date() > new Date(assignment.dueAt)) {
        assignment.status = "expired";
        return NextResponse.json({ error: "This 15-minute judging window expired." }, { status: 409 });
      }

      const scores = SCORE_CATEGORIES.reduce(
        (nextScores, category) => ({
          ...nextScores,
          [category.key]: clampScore(body?.scores?.[category.key]),
        }),
        {} as Record<ScoreKey, number>,
      );

      const judgment: ProtocolJudgment = {
        id: makeId("judgment"),
        assignmentId,
        battleId: battle.id,
        judgeArtistId: assignment.judgeArtistId,
        scores,
        selectedWinnerArtistId,
        createdAt: new Date().toISOString(),
      };

      state.judgments = state.judgments.filter((entry) => entry.assignmentId !== assignmentId);
      state.judgments.push(judgment);
      assignment.status = "completed";
      assignment.completedAt = new Date().toISOString();
      maybeCompleteBattle(state, battle.id);
    }

    if (action === "finalizeRound") {
      const eventId = String(body?.eventId || "");
      const event = state.events.find((entry) => entry.id === eventId);

      if (!event) {
        return NextResponse.json({ error: "Event is required." }, { status: 400 });
      }

      const roundBattles = state.battles.filter((battle) => battle.eventId === eventId && battle.round === event.currentRound);
      if (roundBattles.some((battle) => battle.status !== "complete" || !battle.winnerArtistId)) {
        return NextResponse.json({ error: "All round battles must be complete before advancing." }, { status: 409 });
      }

      const winners = roundBattles.map((battle) => battle.winnerArtistId).filter(Boolean) as string[];
      if (winners.length === 1) {
        const winner = state.artists.find((artist) => artist.id === winners[0]);
        if (winner) {
          winner.status = "winner";
          winner.walletCents += event.desiredPrizeCents;
          winner.rewardCents += event.desiredPrizeCents;
        }
        const gross = state.entries
          .filter((entry) => entry.eventId === eventId)
          .reduce((sum, entry) => sum + entry.paidCents, 0);
        event.winnerArtistId = winners[0];
        event.companyRevenueCents = Math.max(0, gross - event.desiredPrizeCents);
        event.phase = "complete";
        state.walletLedger.push({
          id: makeId("ledger"),
          artistId: winners[0],
          eventId,
          amountCents: event.desiredPrizeCents,
          type: "prize",
          note: `Winner prize for ${event.title}`,
          createdAt: new Date().toISOString(),
        });
        state.walletLedger.push({
          id: makeId("ledger"),
          artistId: null,
          eventId,
          amountCents: event.companyRevenueCents,
          type: "company_revenue",
          note: `Company remainder for ${event.title}`,
          createdAt: new Date().toISOString(),
        });
      } else {
        event.currentRound += 1;
        event.phase = "submission";
        event.submissionDeadline = addHours(new Date(), SUBMISSION_WINDOW_HOURS);
        event.judgingDeadline = null;
        createRoundBattles(state, event.id, event.currentRound, winners);
      }
    }

    await writePilotState(state);
    return NextResponse.json(await readPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Protocol action failed." }, { status: 500 });
  }
}
