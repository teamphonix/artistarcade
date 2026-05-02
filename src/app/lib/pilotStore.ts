import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const ARTISTS_PER_EVENT = 16;
export const MVP_EVENT_COUNT = 4;
export const TOTAL_MVP_ARTISTS = ARTISTS_PER_EVENT * MVP_EVENT_COUNT;
export const SUBMISSION_LIMIT_SECONDS = 180;
export const SUBMISSION_WINDOW_HOURS = 24;
export const JUDGING_WINDOW_MINUTES = 15;
export const JUDGES_PER_BATTLE = 1;

export const SCORE_CATEGORIES = [
  { key: "lyrics", label: "Lyrics", weight: 25 },
  { key: "delivery", label: "Delivery", weight: 20 },
  { key: "originality", label: "Originality", weight: 20 },
  { key: "flow", label: "Flow", weight: 15 },
  { key: "impact", label: "Impact", weight: 20 },
] as const;

export type ScoreKey = (typeof SCORE_CATEGORIES)[number]["key"];
export type EventPhase = "queue" | "submission" | "judging" | "complete";
export type ArtistStatus = "registered" | "queued" | "submitted" | "judging" | "advanced" | "eliminated" | "winner";
export type BattleStatus = "pending" | "judging" | "complete";
export type AssignmentStatus = "assigned" | "opened" | "completed" | "expired";

export type ProtocolArtist = {
  id: string;
  name: string;
  email: string;
  walletCents: number;
  rewardCents: number;
  status: ArtistStatus;
  createdAt: string;
};

export type ProtocolEvent = {
  id: string;
  title: string;
  eventType: "rap";
  creatorArtistId: string;
  desiredPrizeCents: number;
  entryFeeCents: number;
  challengeTitle: string;
  challengeDescription: string;
  challengeAudioUrl: string;
  phase: EventPhase;
  currentRound: number;
  queueOpenedAt: string;
  queueClosedAt: string | null;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  winnerArtistId: string | null;
  companyRevenueCents: number;
};

export type ProtocolEntry = {
  id: string;
  eventId: string;
  artistId: string;
  seed: number;
  paidCents: number;
  status: "queued" | "active" | "eliminated" | "winner";
  joinedAt: string;
};

export type ProtocolSubmission = {
  id: string;
  eventId: string;
  artistId: string;
  round: number;
  title: string;
  audioUrl: string;
  durationSeconds: number;
  submittedAt: string;
};

export type ProtocolBattle = {
  id: string;
  eventId: string;
  round: number;
  slot: number;
  artistAId: string;
  artistBId: string;
  status: BattleStatus;
  winnerArtistId: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ProtocolAssignment = {
  id: string;
  battleId: string;
  judgeArtistId: string;
  status: AssignmentStatus;
  assignedAt: string;
  openedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
};

export type ProtocolJudgment = {
  id: string;
  assignmentId: string;
  battleId: string;
  judgeArtistId: string;
  scores: Record<ScoreKey, number>;
  selectedWinnerArtistId: string;
  createdAt: string;
};

export type WalletLedgerEntry = {
  id: string;
  artistId: string | null;
  eventId: string | null;
  amountCents: number;
  type: "deposit" | "withdraw" | "entry_fee" | "prize" | "company_revenue";
  note: string;
  createdAt: string;
};

export type ProtocolState = {
  settings: {
    artistsPerEvent: number;
    eventCount: number;
    totalArtists: number;
    submissionLimitSeconds: number;
    submissionWindowHours: number;
    judgingWindowMinutes: number;
    judgesPerBattle: number;
  };
  artists: ProtocolArtist[];
  events: ProtocolEvent[];
  entries: ProtocolEntry[];
  submissions: ProtocolSubmission[];
  battles: ProtocolBattle[];
  assignments: ProtocolAssignment[];
  judgments: ProtocolJudgment[];
  walletLedger: WalletLedgerEntry[];
};

const dataDirectory = process.env.VERCEL ? "/tmp/artistarcade-data" : path.join(process.cwd(), "data");
const pilotPath = path.join(dataDirectory, "pilot-state.json");

export function makeId() {
  return randomUUID();
}

function isoPlus(hours = 0, minutes = 0) {
  const date = new Date("2026-04-23T12:00:00.000Z");
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function seedUuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

const seedArtists: ProtocolArtist[] = Array.from({ length: TOTAL_MVP_ARTISTS }, (_, index) => ({
  id: seedUuid(index + 1),
  name: `Pilot Artist ${index + 1}`,
  email: `artist${index + 1}@example.com`,
  walletCents: 100,
  rewardCents: 0,
  status: "registered",
  createdAt: isoPlus(0, index),
}));

const eventTitles = ["Lyrical Onslaught", "Story Mode", "Beat Talk", "Persona Pen"];

const seedEvents: ProtocolEvent[] = eventTitles.map((title, index) => ({
  id: seedUuid(101 + index),
  title,
  eventType: "rap",
  creatorArtistId: seedArtists[0].id,
  desiredPrizeCents: 500,
  entryFeeCents: 100,
  challengeTitle: `${title}: Round 1`,
  challengeDescription:
    "Create an original rap performance to the provided MP3. Maximum length is 3 minutes. Clean delivery, original writing, and impact decide the bracket.",
  challengeAudioUrl: "https://example.com/challenges/pilot-beat.mp3",
  phase: "queue",
  currentRound: 1,
  queueOpenedAt: isoPlus(),
  queueClosedAt: null,
  submissionDeadline: null,
  judgingDeadline: null,
  winnerArtistId: null,
  companyRevenueCents: 0,
}));

export const seedPilotState: ProtocolState = {
  settings: {
    artistsPerEvent: ARTISTS_PER_EVENT,
    eventCount: MVP_EVENT_COUNT,
    totalArtists: TOTAL_MVP_ARTISTS,
    submissionLimitSeconds: SUBMISSION_LIMIT_SECONDS,
    submissionWindowHours: SUBMISSION_WINDOW_HOURS,
    judgingWindowMinutes: JUDGING_WINDOW_MINUTES,
    judgesPerBattle: JUDGES_PER_BATTLE,
  },
  artists: seedArtists,
  events: seedEvents,
  entries: [],
  submissions: [],
  battles: [],
  assignments: [],
  judgments: [],
  walletLedger: [],
};

export async function readPilotState() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    const existing = await fs.readFile(pilotPath, "utf8");
    return JSON.parse(existing) as ProtocolState;
  } catch {
    await writePilotState(seedPilotState);
    return structuredClone(seedPilotState);
  }
}

export async function writePilotState(state: ProtocolState) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(pilotPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function resetPilotState() {
  const nextState = structuredClone(seedPilotState);
  await writePilotState(nextState);
  return nextState;
}

export function centsToUsd(cents: number) {
  return Math.round(cents) / 100;
}

export function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(score)));
}

export function weightedScore(scores: Record<ScoreKey, number>) {
  const total = SCORE_CATEGORIES.reduce((sum, category) => {
    return sum + clampScore(scores[category.key]) * category.weight;
  }, 0);

  return Math.round(total / 10);
}

export function getEventEntries(state: ProtocolState, eventId: string) {
  return state.entries
    .filter((entry) => entry.eventId === eventId)
    .sort((a, b) => a.seed - b.seed)
    .map((entry) => ({
      ...entry,
      artist: state.artists.find((artist) => artist.id === entry.artistId),
    }));
}

export function scoreBattle(state: ProtocolState, battleId: string) {
  const battle = state.battles.find((entry) => entry.id === battleId);
  if (!battle) {
    return null;
  }

  const judgments = state.judgments.filter((judgment) => judgment.battleId === battleId);
  const artistScores = [battle.artistAId, battle.artistBId].map((artistId) => {
    const votes = judgments.filter((judgment) => judgment.selectedWinnerArtistId === artistId).length;
    const scoreTotal = judgments
      .filter((judgment) => judgment.selectedWinnerArtistId === artistId)
      .reduce((sum, judgment) => sum + weightedScore(judgment.scores), 0);

    return {
      artistId,
      votes,
      score: scoreTotal,
    };
  });

  artistScores.sort((a, b) => b.votes - a.votes || b.score - a.score);

  return {
    battle,
    judgments,
    artistScores,
    winnerArtistId: artistScores[0]?.artistId || null,
  };
}

export function eventStandings(state: ProtocolState, eventId: string) {
  const entries = getEventEntries(state, eventId);
  return entries.map((entry) => {
    const battles = state.battles.filter(
      (battle) => battle.artistAId === entry.artistId || battle.artistBId === entry.artistId,
    );
    const wins = battles.filter((battle) => battle.winnerArtistId === entry.artistId).length;
    const losses = battles.filter((battle) => battle.status === "complete" && battle.winnerArtistId !== entry.artistId)
      .length;

    return {
      ...entry,
      wins,
      losses,
    };
  });
}
