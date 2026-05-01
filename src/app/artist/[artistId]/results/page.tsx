"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Artist = {
  id: string;
  name: string;
  email: string;
  walletCents: number;
  rewardCents: number;
  status: string;
};

type EventSummary = {
  id: string;
  title: string;
  challengeTitle: string;
  challengeDescription: string;
  winnerArtistId: string | null;
  entries: Array<{ artistId: string }>;
};

type Battle = {
  id: string;
  eventId: string;
  round: number;
  slot: number;
  artistAId: string;
  artistBId: string;
  status: string;
  winnerArtistId: string | null;
};

type Assignment = {
  id: string;
  battleId: string;
  judgeArtistId: string;
  status: string;
};

type Submission = {
  id: string;
  eventId: string;
  artistId: string;
  round: number;
  title: string;
  audioUrl: string;
  durationSeconds: number;
};

type Judgment = {
  id: string;
  assignmentId: string;
  battleId: string;
  judgeArtistId: string;
  selectedWinnerArtistId: string;
};

type ProtocolPayload = {
  artists: Artist[];
  events: EventSummary[];
  battles: Battle[];
  assignments: Assignment[];
  submissions: Submission[];
  judgments: Judgment[];
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ArtistResultsPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId;
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function start() {
      try {
        const response = await fetch("/api/pilot", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load results.");
        }

        if (isMounted) {
          setPayload(data);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load results.");
        }
      }
    }

    void start();

    return () => {
      isMounted = false;
    };
  }, []);

  const artist = payload?.artists.find((entry) => entry.id === artistId) || null;
  const eventRoom = payload?.events.find((event) => event.entries.some((entry) => entry.artistId === artistId)) || null;
  const artistBattles = useMemo(() => {
    if (!payload || !eventRoom) {
      return [];
    }

    return payload.battles
      .filter(
        (battle) =>
          battle.eventId === eventRoom.id && (battle.artistAId === artistId || battle.artistBId === artistId),
      )
      .sort((a, b) => a.round - b.round || a.slot - b.slot);
  }, [artistId, eventRoom, payload]);

  const roundsJudged = payload?.judgments.filter((judgment) => judgment.judgeArtistId === artistId).length || 0;

  if (!payload || !artist) {
    return (
      <main className="artist-dashboard-page">
        <section className="artist-dashboard-shell">
          <p>{message || "Loading results..."}</p>
          <Link href="/artist">Return to artist access</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="artist-dashboard-page">
      <section className="artist-dashboard-shell">
        <header className="artist-room-header">
          <div>
            <span className="artist-entry-kicker">Results Room</span>
            <h1>{eventRoom?.title || "No event yet"}</h1>
            <p>{artist.name}</p>
          </div>
          <div className="artist-dashboard-links">
            <Link className="artist-room-link" href={`/artist/${artist.id}`}>
              Back to dashboard
            </Link>
            <Link className="artist-room-link secondary" href={`/artist/${artist.id}/event`}>
              Open event room
            </Link>
          </div>
        </header>

        {message ? <p className="artist-entry-message">{message}</p> : null}

        <section className="artist-dashboard-grid">
          <article className="artist-dashboard-card">
            <span>Status</span>
            <strong>{artist.status}</strong>
            <em>{artist.status === "winner" ? "Protocol complete" : "Result recorded"}</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Wallet</span>
            <strong>{money(artist.walletCents)}</strong>
            <em>Rewards earned {money(artist.rewardCents)}</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Rounds survived</span>
            <strong>{artistBattles.filter((battle) => battle.winnerArtistId === artistId).length}</strong>
            <em>{artistBattles.length} battles recorded</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Judging duty</span>
            <strong>{roundsJudged}</strong>
            <em>Decisions submitted</em>
          </article>
        </section>

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Final outcome</h2>
          {eventRoom ? (
            <div className="artist-dashboard-event">
              <strong>
                {artist.status === "winner"
                  ? "Congratulations. You won the event."
                  : eventRoom.winnerArtistId
                    ? `Winner: ${payload.artists.find((entry) => entry.id === eventRoom.winnerArtistId)?.name || "Finalist"}`
                    : "Event still resolving"}
              </strong>
              <span>Challenge: {eventRoom.challengeTitle}</span>
              <span>{eventRoom.challengeDescription}</span>
              <span>
                {artist.status === "winner"
                  ? `Prize credited: ${money(artist.rewardCents)}`
                  : "Review each round below to see where your run ended."}
              </span>
            </div>
          ) : (
            <p>Join an event to unlock results tracking.</p>
          )}
        </section>

        <section className="artist-results-stack">
          {artistBattles.length > 0 ? (
            artistBattles.map((battle) => {
              const opponentId = battle.artistAId === artistId ? battle.artistBId : battle.artistAId;
              const opponent = payload.artists.find((entry) => entry.id === opponentId) || null;
              const artistSubmission = payload.submissions.find(
                (entry) => entry.eventId === battle.eventId && entry.artistId === artistId && entry.round === battle.round,
              );
              const opponentSubmission = payload.submissions.find(
                (entry) => entry.eventId === battle.eventId && entry.artistId === opponentId && entry.round === battle.round,
              );
              const assignment = payload.assignments.find((entry) => entry.battleId === battle.id) || null;
              const judgment = assignment
                ? payload.judgments.find((entry) => entry.assignmentId === assignment.id) || null
                : null;
              const advanced = battle.winnerArtistId === artistId;

              return (
                <article className="artist-result-card" key={battle.id}>
                  <div className="artist-result-header">
                    <div>
                      <span>Round {battle.round}</span>
                      <strong>{advanced ? "Advanced" : battle.status === "complete" ? "Eliminated" : "In progress"}</strong>
                    </div>
                    <em>{opponent ? `Against ${opponent.name}` : "Opponent pending"}</em>
                  </div>
                  <div className="artist-result-matchups">
                    <div className="artist-result-track">
                      <span>Your submission</span>
                      <strong>{artistSubmission?.title || "Not available"}</strong>
                      {artistSubmission?.audioUrl ? (
                        <audio controls controlsList="nodownload" preload="none" src={artistSubmission.audioUrl} />
                      ) : (
                        <small>No playback available.</small>
                      )}
                    </div>
                    <div className="artist-result-track">
                      <span>Opponent submission</span>
                      <strong>{opponentSubmission?.title || "Not available"}</strong>
                      {opponentSubmission?.audioUrl ? (
                        <audio controls controlsList="nodownload" preload="none" src={opponentSubmission.audioUrl} />
                      ) : (
                        <small>No playback available.</small>
                      )}
                    </div>
                  </div>
                  <div className="artist-result-footer">
                    <span>
                      {judgment?.selectedWinnerArtistId
                        ? `Decision went to ${payload.artists.find((entry) => entry.id === judgment.selectedWinnerArtistId)?.name || "winner"}`
                        : "Judgment still pending"}
                    </span>
                    <strong>{advanced ? "You moved forward" : battle.status === "complete" ? "Your run ended here" : "Awaiting resolution"}</strong>
                  </div>
                </article>
              );
            })
          ) : (
            <section className="artist-dashboard-panel artist-dashboard-panel-wide">
              <h2>No rounds recorded yet</h2>
              <p>Your event results will populate here once battles and judgments begin closing.</p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
