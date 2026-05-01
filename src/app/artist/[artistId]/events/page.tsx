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
  challengeDescription: string;
  phase: string;
  queuedCount: number;
  queueClosedAt: string | null;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  entries: Entry[];
};

type ProtocolPayload = {
  artists: Artist[];
  events: EventSummary[];
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

export default function ArtistEventsPortalPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId;
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [selectedType, setSelectedType] = useState("rap");
  const [selectedEventId, setSelectedEventId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function start() {
      try {
        const response = await fetch("/api/pilot", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load events portal.");
        }

        if (isMounted) {
          setPayload(data);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load events portal.");
        }
      }
    }

    void start();

    return () => {
      isMounted = false;
    };
  }, []);

  async function joinEvent(eventId: string) {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "joinEvent",
          artistId,
          eventId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not join event.");
      }

      setPayload(data);
      setSelectedEventId("");
      setMessage("Event joined. Your profile is now locked into that queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join event.");
    } finally {
      setIsBusy(false);
    }
  }

  const artist = payload?.artists.find((entry) => entry.id === artistId) || null;
  const currentEntry = payload?.events.flatMap((event) => event.entries).find((entry) => entry.artistId === artistId) || null;
  const eventTypes = useMemo(() => {
    const types = new Set((payload?.events || []).map((event) => event.eventType || "rap"));
    return Array.from(types);
  }, [payload]);
  const visibleEvents =
    payload?.events.filter(
      (event) => event.eventType === selectedType && event.phase === "queue" && event.queuedCount < 16,
    ) || [];
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) || null;

  if (!payload || !artist) {
    return (
      <main className="artist-dashboard-page">
        <section className="artist-dashboard-shell">
          <p>{message || "Loading events portal..."}</p>
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
            <span className="artist-entry-kicker">Events Portal</span>
            <h1>Choose Your Arena</h1>
            <p>{artist.name}</p>
          </div>
          <div className="artist-dashboard-links">
            <Link className="artist-room-link" href={`/artist/${artist.id}`}>
              Back to dashboard
            </Link>
            <Link className="artist-room-link secondary" href={`/artist/${artist.id}/results`}>
              View results
            </Link>
          </div>
        </header>

        {message ? <p className="artist-entry-message">{message}</p> : null}

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Event types</h2>
          <div className="artist-type-grid">
            {eventTypes.map((type) => (
              <button
                className={selectedType === type ? "artist-type-card is-active" : "artist-type-card"}
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setSelectedEventId("");
                }}
                type="button"
              >
                <span>Portal</span>
                <strong>{type}</strong>
                <em>{type === "rap" ? "Lyrical battle events" : "Live event type"}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Available events</h2>
          <p>
            Pick the prize tile to inspect the event. The beat stays hidden until the queue fills and the event officially opens.
          </p>
          <div className="artist-event-grid">
            {visibleEvents.length > 0 ? (
              visibleEvents.map((event) => (
                <button
                  className={selectedEventId === event.id ? "artist-event-tile is-active" : "artist-event-tile"}
                  disabled={!!currentEntry}
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  type="button"
                >
                  <span>Prize</span>
                  <strong>{money(event.desiredPrizeCents)}</strong>
                  <em>{event.title}</em>
                </button>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No open events</strong>
                <span>That portal does not have an available queue right now.</span>
              </div>
            )}
          </div>
        </section>

        {selectedEvent ? (
          <section className="artist-dashboard-panel artist-dashboard-panel-wide artist-event-popup">
            <h2>{selectedEvent.title}</h2>
            <div className="artist-dashboard-event">
              <strong>{selectedEvent.challengeTitle}</strong>
              <span>{selectedEvent.challengeDescription}</span>
              <span>Starts (ET): {easternTime(selectedEvent.queueClosedAt)}</span>
              <span>Submission deadline (ET): {easternTime(selectedEvent.submissionDeadline)}</span>
              <span>
                Queue: {selectedEvent.queuedCount}/16 | Entry {money(selectedEvent.entryFeeCents)} | Prize{" "}
                {money(selectedEvent.desiredPrizeCents)}
              </span>
            </div>
            <button
              disabled={isBusy || !!currentEntry}
              onClick={() => void joinEvent(selectedEvent.id)}
              type="button"
            >
              {currentEntry ? "Already in an event" : "Join this event"}
            </button>
          </section>
        ) : null}
      </section>
    </main>
  );
}
