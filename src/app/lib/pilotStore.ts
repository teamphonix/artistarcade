import { promises as fs } from "fs";
import path from "path";

export type PilotArtist = {
  id: string;
  name: string;
  email: string;
  walletUsd: number;
  credits: number;
  status: "entered" | "submitted" | "judging" | "advanced" | "eliminated" | "winner";
};

export type PilotSubmission = {
  id: string;
  artistId: string;
  title: string;
  audioUrl: string;
  challenge: string;
  createdAt: string;
};

export type PilotJudgment = {
  id: string;
  judgeArtistId: string;
  submissionId: string;
  lyrics: number;
  delivery: number;
  originality: number;
  impact: number;
  createdAt: string;
};

export type PilotJudgingAssignment = {
  id: string;
  judgeArtistId: string;
  submissionId: string;
  round: number;
  status: "assigned" | "completed";
  assignedAt: string;
  completedAt: string | null;
};

export type PilotState = {
  event: {
    id: string;
    name: string;
    entryFee: number;
    prize: number;
    submissionWindow: string;
    judgingWindow: string;
    challenge: string;
    phase: "entry" | "submission" | "judging" | "results";
  };
  artists: PilotArtist[];
  submissions: PilotSubmission[];
  judgingAssignments: PilotJudgingAssignment[];
  judgments: PilotJudgment[];
};

const dataDirectory = path.join(process.cwd(), "data");
const pilotPath = path.join(dataDirectory, "pilot-state.json");

export const seedPilotState: PilotState = {
  event: {
    id: "pilot-001",
    name: "Pilot Ring A",
    entryFee: 1,
    prize: 5,
    submissionWindow: "48 hours",
    judgingWindow: "3 anonymous submissions",
    challenge: "Original vocal performance using the provided beat and concept",
    phase: "submission",
  },
  artists: [
    {
      id: "artist-a",
      name: "Nova Saint",
      email: "nova@example.com",
      walletUsd: 9,
      credits: 2,
      status: "submitted",
    },
    {
      id: "artist-b",
      name: "Cipher Rae",
      email: "cipher@example.com",
      walletUsd: 4,
      credits: 1,
      status: "submitted",
    },
    {
      id: "artist-c",
      name: "Krown Vell",
      email: "krown@example.com",
      walletUsd: 6,
      credits: 0,
      status: "judging",
    },
  ],
  submissions: [
    {
      id: "sub-a",
      artistId: "artist-a",
      title: "No Crown Without Fire",
      audioUrl: "https://example.com/audio/nova-saint.mp3",
      challenge: "Lyrical Onslaught",
      createdAt: "2026-04-23T00:00:00.000Z",
    },
    {
      id: "sub-b",
      artistId: "artist-b",
      title: "Warehouse Psalms",
      audioUrl: "https://example.com/audio/cipher-rae.mp3",
      challenge: "Story Mode",
      createdAt: "2026-04-23T00:05:00.000Z",
    },
  ],
  judgingAssignments: [
    {
      id: "assign-a",
      judgeArtistId: "artist-c",
      submissionId: "sub-a",
      round: 1,
      status: "completed",
      assignedAt: "2026-04-23T00:30:00.000Z",
      completedAt: "2026-04-23T01:00:00.000Z",
    },
    {
      id: "assign-b",
      judgeArtistId: "artist-a",
      submissionId: "sub-b",
      round: 1,
      status: "assigned",
      assignedAt: "2026-04-23T00:30:00.000Z",
      completedAt: null,
    },
  ],
  judgments: [
    {
      id: "judgment-a",
      judgeArtistId: "artist-c",
      submissionId: "sub-a",
      lyrics: 4,
      delivery: 5,
      originality: 4,
      impact: 5,
      createdAt: "2026-04-23T01:00:00.000Z",
    },
  ],
};

export async function readPilotState() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    const existing = await fs.readFile(pilotPath, "utf8");
    return JSON.parse(existing) as PilotState;
  } catch {
    await writePilotState(seedPilotState);
    return seedPilotState;
  }
}

export async function writePilotState(state: PilotState) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(pilotPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function scoreSubmission(state: PilotState, submissionId: string) {
  const judgments = state.judgments.filter((judgment) => judgment.submissionId === submissionId);
  if (judgments.length === 0) {
    return 0;
  }

  const total = judgments.reduce((sum, judgment) => {
    return sum + judgment.lyrics + judgment.delivery + judgment.originality + judgment.impact;
  }, 0);

  return Math.round((total / (judgments.length * 20)) * 100);
}

export function rankedSubmissions(state: PilotState) {
  return state.submissions
    .map((submission) => ({
      ...submission,
      artist: state.artists.find((artist) => artist.id === submission.artistId),
      score: scoreSubmission(state, submission.id),
      judgmentCount: state.judgments.filter((judgment) => judgment.submissionId === submission.id).length,
    }))
    .sort((a, b) => b.score - a.score);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function resetPilotState() {
  await writePilotState(seedPilotState);
  return seedPilotState;
}
