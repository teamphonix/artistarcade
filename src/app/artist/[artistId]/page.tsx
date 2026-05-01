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

type Entry = {
  id: string;
  eventId: string;
  artistId: string;
  seed: number;
  paidCents: number;
  status: string;
};

type EventSummary = {
  id: string;
  title: string;
  eventType: string;
  desiredPrizeCents: number;
  entryFeeCents: number;
  challengeTitle: string;
  phase: string;
  queuedCount: number;
  queueClosedAt: string | null;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  winnerArtistId: string | null;
  entries: Entry[];
};

type ProtocolPayload = {
  artists: Artist[];
  events: EventSummary[];
  entries: number;
  submissions: Array<{
    id: string;
    eventId: string;
    artistId: string;
    round: number;
    title: string;
    audioUrl: string;
  }>;
  assignments: Array<{
    id: string;
    battleId: string;
    judgeArtistId: string;
    status: string;
    dueAt: string | null;
  }>;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function shortTime(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Date(date).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function easternTime(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function relativeCountdown(date: string | null) {
  if (!date) {
    return "Awaiting trigger";
  }

  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) {
    return "Ready now";
  }

  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export default function ArtistDashboardPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId;
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [depositAmount, setDepositAmount] = useState(100);

  async function loadProtocol() {
    const response = await fetch("/api/pilot", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load artist dashboard.");
    }

    setPayload(data);
  }

  useEffect(() => {
    let isMounted = true;

    async function start() {
      try {
        await loadProtocol();
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load artist dashboard.");
        }
      }
    }

    void start();

    return () => {
      isMounted = false;
    };
  }, []);

  async function postProtocol(action: string, body = {}) {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Protocol action failed.");
      }

      setPayload(data);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Protocol action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const artist = payload?.artists.find((entry) => entry.id === artistId);
  const currentEntry = useMemo(() => {
    if (!payload || !artist) {
      return null;
    }

    return payload.events
      .flatMap((event) => event.entries || [])
      .find((entry: Entry) => entry.artistId === artist.id) || null;
  }, [payload, artist]);

  const currentEvent = payload?.events.find((event) => event.id === currentEntry?.eventId) || null;
  const availableEvents = payload?.events.filter((event) => event.phase === "queue" && event.queuedCount < 16) || [];
  const artistSubmission = payload?.submissions.find(
    (submission) => submission.artistId === artistId && submission.eventId === currentEvent?.id,
  );
  const artistAssignment = payload?.assignments.find(
    (assignment) => assignment.judgeArtistId === artistId && assignment.status === "assigned",
  );

  if (!payload || !artist) {
    return (
      <main className="artist-dashboard-page">
        <section className="artist-dashboard-shell">
          <p>{message || "Loading artist dashboard..."}</p>
          <Link href="/artist">Return to artist access</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="artist-dashboard-page">
      <section className="artist-dashboard-shell">
        <header className="artist-dashboard-header">
          <div>
            <span className="artist-entry-kicker">Artist Dashboard</span>
            <h1>{artist.name}</h1>
            <p>{artist.email}</p>
          </div>
          <div className="artist-dashboard-links">
            <Link className="artist-room-link" href={`/artist/${artist.id}/event`}>
              Open event room
            </Link>
            <Link className="artist-room-link secondary" href={`/artist/${artist.id}/results`}>
              View results
            </Link>
          </div>
        </header>

        {message ? <p className="artist-entry-message">{message}</p> : null}

        <section className="artist-dashboard-grid">
          <article className="artist-dashboard-card">
            <span>Wallet</span>
            <strong>{money(artist.walletCents)}</strong>
            <em>Rewards earned {money(artist.rewardCents)}</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Status</span>
            <strong>{artist.status}</strong>
            <em>{currentEvent ? currentEvent.title : "No current event"}</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Submission</span>
            <strong>{artistSubmission?.title || "Not submitted"}</strong>
            <em>{currentEvent ? relativeCountdown(currentEvent.submissionDeadline) : "Join an event first"}</em>
          </article>
          <article className="artist-dashboard-card">
            <span>Judging</span>
            <strong>{artistAssignment ? "Assignment live" : "Stand by"}</strong>
            <em>{artistAssignment?.dueAt ? relativeCountdown(artistAssignment.dueAt) : "No active judging card"}</em>
          </article>
        </section>

        <section className="artist-dashboard-columns">
          <form
            className="artist-dashboard-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void postProtocol("deposit", {
                name: artist.name,
                email: artist.email,
                amountCents: depositAmount,
              });
            }}
          >
            <h2>Add funds</h2>
            <label>
              Amount in cents
              <input
                min="100"
                step="100"
                type="number"
                value={depositAmount}
                onChange={(event) => setDepositAmount(Number(event.target.value))}
              />
            </label>
            <button disabled={isBusy} type="submit">
              Add wallet funds
            </button>
          </form>

          <article className="artist-dashboard-panel">
            <h2>Events portal</h2>
            <p>
              Pick your event type first, then step into the live portal to see the available contests of that type.
              The beat stays hidden until the queue is full and the event officially opens.
            </p>
            <div className="artist-dashboard-event">
              <span>{availableEvents.length} events open for entry</span>
              <span>{currentEntry ? "You are already locked into an event." : "Choose your next battle from the portal."}</span>
            </div>
            <Link className="artist-room-link" href={`/artist/${artist.id}/events`}>
              Open events portal
            </Link>
          </article>
        </section>

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Current event</h2>
          {currentEvent ? (
            <div className="artist-dashboard-event">
              <strong>{currentEvent.title}</strong>
              <span>Challenge: {currentEvent.challengeTitle}</span>
              <span>Starts (ET): {easternTime(currentEvent.queueClosedAt)}</span>
              <span>Submission deadline: {shortTime(currentEvent.submissionDeadline)}</span>
              <span>Judging deadline: {shortTime(currentEvent.judgingDeadline)}</span>
              <span>Queue count: {currentEvent.queuedCount}/16</span>
              <div className="artist-dashboard-links">
                <Link className="artist-room-link secondary" href={`/artist/${artist.id}/event`}>
                  Enter event room
                </Link>
                <Link className="artist-room-link secondary" href={`/artist/${artist.id}/results`}>
                  Open results
                </Link>
              </div>
            </div>
          ) : (
            <p>No active event yet. Join one of the open queues to enter the protocol.</p>
          )}
        </section>
      </section>
    </main>
  );
}
