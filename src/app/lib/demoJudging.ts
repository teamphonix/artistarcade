import { SCORE_CATEGORIES } from "./scoreCategories";

export const DEMO_EVENTS = [
  { slug: "lyrical", title: "Lyrical Onslaught" },
  { slug: "story", title: "Story Mode" },
  { slug: "beat", title: "Beat Talk" },
  { slug: "persona", title: "Persona Pen" },
] as const;

// Client-only fixtures. Never call the protocol API or credit a real wallet.
export function createDemoJudging(artistId: string, wave = 1) {
  const event = DEMO_EVENTS.find((item) => artistId === `demo-${item.slug}`) || DEMO_EVENTS[0];
  const now = new Date().toISOString();
  const dueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const eventId = `demo-event-${event.slug}`;
  const token = crypto.randomUUID();
  const artistAId = `demo-a-${token}`;
  const artistBId = `demo-b-${token}`;
  const battleId = `demo-battle-${token}`;
  return {
    artists: [
      { id: artistId, name: "Test FateKeeper", walletCents: 0, rewardCents: 0, status: "judging" },
      { id: artistAId, name: `Nova ${wave}`, walletCents: 0, rewardCents: 0, status: "submitted" },
      { id: artistBId, name: `Cipher ${wave}`, walletCents: 0, rewardCents: 0, status: "submitted" },
    ],
    events: [{
      id: eventId, title: `${event.title} — Mock Event`,
      challengeTitle: `Test judging card ${wave}`,
      challengeDescription: "Placeholder instrumental MP3s for testing playback, seeking, independent scores and Lock fate. This is a local simulation, not a real competition or payout.",
      challengeAudioUrl: "/audio/demo-a.mp3", phase: "judging", currentRound: 1,
      queueClosedAt: now, submissionDeadline: null, judgingDeadline: dueAt,
      entries: [{ artistId }],
    }],
    battles: [{ id: battleId, eventId, round: 1, artistAId, artistBId }],
    assignments: [{ id: `demo-assignment-${token}`, battleId, judgeArtistId: artistId, status: "assigned", dueAt }],
    submissions: [
      { id: `demo-track-a-${token}`, eventId, artistId: artistAId, round: 1, title: "Gold pulse — placeholder MP3", audioUrl: "/audio/demo-a.mp3", durationSeconds: 24 },
      { id: `demo-track-b-${token}`, eventId, artistId: artistBId, round: 1, title: "Cyan pulse — placeholder MP3", audioUrl: "/audio/demo-b.mp3", durationSeconds: 24 },
    ],
    scoreCategories: [...SCORE_CATEGORIES],
  };
}
