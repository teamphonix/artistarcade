import type { ProtocolState } from "./pilotStore";
import { pilotClock } from "./tournament";

export type Principal = { email: string; host: boolean };
export class AccessError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
const hostActions = new Set(["updateEvent", "closeQueue", "generateJudgeAssignments", "finalizeRound"]);
const artistActions = new Set(["upsertArtist", "updateNotificationPreferences", "joinEvent", "submit", "judge"]);

export function authorizeAction(state: ProtocolState, principal: Principal, action: string, body: Record<string, unknown>) {
  if (hostActions.has(action)) {
    if (!principal.host) throw new AccessError("Host access required.");
    return;
  }
  if (!artistActions.has(action)) throw new AccessError("Unsupported action.");
  if (action === "upsertArtist") {
    if (String(body.email || "").trim().toLowerCase() !== principal.email) throw new AccessError("Use your verified email.");
    return;
  }
  const artist = state.artists.find(a => a.email.toLowerCase() === principal.email);
  const owner = action === "judge" ? state.assignments.find(a => a.id === body.assignmentId)?.judgeArtistId : body.artistId;
  if (!artist || owner !== artist.id) throw new AccessError("This action belongs to another artist.");
}

export function artistState(state: ProtocolState, email: string): ProtocolState {
  const own = state.artists.find(a => a.email.toLowerCase() === email);
  const revealed = pilotClock(state)?.revealed === true;
  const assignments = state.assignments.filter(a => a.judgeArtistId === own?.id);
  const activeIds = new Set(assignments.filter(a => ["assigned", "opened"].includes(a.status)).map(a => a.battleId));
  const battles = state.battles.filter(b => activeIds.has(b.id) || (revealed && [b.artistAId, b.artistBId].includes(own?.id || "")));
  const visibleArtists = new Set([own?.id, ...battles.flatMap(b => [b.artistAId, b.artistBId])]);
  return {
    ...state,
    artists: state.artists.filter(a => visibleArtists.has(a.id)).map(a => a.id === own?.id
      ? { ...a, status: revealed ? a.status : "registered" }
      : { id: a.id, name: a.name, email: "", walletCents: 0, rewardCents: 0, status: "registered", createdAt: "" }),
    entries: state.entries.filter(e => e.artistId === own?.id).map(e => ({ ...e, status: revealed ? e.status : "active" })),
    events: state.events.map(e => ({ ...e, winnerArtistId: revealed ? e.winnerArtistId : null, companyRevenueCents: 0 })),
    battles: battles.map(b => revealed ? b : { ...b, winnerArtistId: null, completedAt: null }),
    assignments,
    submissions: state.submissions.filter(s => s.artistId === own?.id || battles.some(b => b.eventId === s.eventId && [b.artistAId, b.artistBId].includes(s.artistId))),
    judgments: revealed ? state.judgments.filter(j => battles.some(b => b.id === j.battleId)) : [],
    judgmentEvents: [],
    walletLedger: state.walletLedger.filter(l => l.artistId === own?.id && (revealed || l.type !== "prize")),
    auditLog: [],
  };
}
