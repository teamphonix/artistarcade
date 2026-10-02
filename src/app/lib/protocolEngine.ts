import { advancePilot } from "./tournament";
import { ARTISTS_PER_EVENT, SUBMISSION_WINDOW_HOURS, makeId, type ProtocolBattle, type ProtocolState } from "./pilotStore";

function addHours(date: Date, hours: number) { return new Date(date.getTime() + hours * 3600000).toISOString(); }
function logProtocolEvent(state: ProtocolState, action: string, note: string, options: { eventId: string; metadata: Record<string, unknown> }) {
  state.auditLog.push({ id: makeId(), action, note, eventId: options.eventId, artistId: null, metadata: options.metadata, createdAt: new Date().toISOString() });
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
        id: makeId(),
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

export function lockEventQueue(state: ProtocolState, eventId: string) {
  const event = state.events.find((entry) => entry.id === eventId);
  const entries = state.entries.filter((entry) => entry.eventId === eventId).sort((a, b) => a.seed - b.seed);

  if (!event || event.phase !== "queue" || entries.length !== ARTISTS_PER_EVENT) {
    return false;
  }

  event.phase = "submission";
  const scheduledStart = event.queueClosedAt ? new Date(event.queueClosedAt) : new Date();
  event.queueClosedAt = scheduledStart.toISOString();
  event.submissionDeadline = event.submissionDeadline || addHours(scheduledStart, SUBMISSION_WINDOW_HOURS);
  entries.forEach((entry) => {
    entry.status = "active";
    const artist = state.artists.find((savedArtist) => savedArtist.id === entry.artistId);
    if (artist) {
      artist.status = "queued";
    }
  });
  createRoundBattles(
    state,
    event.id,
    1,
    entries.map((entry) => entry.artistId),
  );
  logProtocolEvent(state, "queue_locked", `${event.title} queue locked at ${entries.length} artists.`, {
    eventId: event.id,
    metadata: {
      submissionDeadline: event.submissionDeadline,
      artistIds: entries.map((entry) => entry.artistId),
    },
  });

  return true;
}

export function autoAdvanceProtocol(state: ProtocolState) {
  let changed = false;
  for (const event of state.events) {
    if (lockEventQueue(state, event.id)) changed = true;
  }
  return advancePilot(state) || changed;
}
