"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TournamentRules from "@/app/components/TournamentRules";
import { PILOT_RULES_VERSION } from "@/app/lib/pilotCopy";

type Artist = {
  id: string;
  name: string;
  email: string;
  walletCents: number;
  rewardCents: number;
  status: string;
  betaRulesAcceptedAt?: string | null;
  betaRulesVersion?: string | null;
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
  const [acceptBetaRules, setAcceptBetaRules] = useState(false);

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
          acceptBetaRules,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not join event.");
      }

      setPayload(data);
      setSelectedEventId("");
      setAcceptBetaRules(false);
      setMessage("Entry confirmed. Your track will compete in this event.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join event.");
    } finally {
      setIsBusy(false);
    }
  }

  const artist = payload?.artists.find((entry) => entry.id === artistId) || null;
  const currentEntry = payload?.events.flatMap((event) => event.entries).find((entry) => entry.artistId === artistId) || null;
  const currentEvent = payload?.events.find((event) => event.id === currentEntry?.eventId) || null;
  const eventTypes = useMemo(() => {
    const types = new Set((payload?.events || []).map((event) => event.eventType || "rap"));
    return Array.from(types);
  }, [payload]);
  const visibleEvents =
    payload?.events.filter(
      (event) => event.eventType === selectedType && event.phase === "queue" && event.queuedCount < 16,
    ) || [];
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) || null;
  const betaRulesAccepted = Boolean(artist?.betaRulesAcceptedAt && artist.betaRulesVersion === PILOT_RULES_VERSION);

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
            <span className="artist-entry-kicker">Arena</span>
            <h1>Available events</h1>
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

        {currentEvent ? (
          <section className="artist-dashboard-panel artist-dashboard-panel-wide artist-next-step">
            <div>
              <span>Current event</span>
              <h2>{currentEvent.title}</h2>
              <p>
                Your entry is confirmed. Open your event room to follow the
                next protocol step and submit when the window goes live.
              </p>
            </div>
            <Link className="artist-room-link" href={`/artist/${artist.id}/event`}>
              Open event room
            </Link>
          </section>
        ) : null}

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Event categories</h2>
          <div className="artist-type-grid">
            {eventTypes.map((type) => (
              <button
                className={selectedType === type ? "artist-type-card is-active" : "artist-type-card"}
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setSelectedEventId("");
                  setAcceptBetaRules(false);
                }}
                type="button"
              >
                <span>Category</span>
                <strong>{type}</strong>
                <em>{type === "rap" ? "Rap battle protocol" : "Beta event type"}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Available events</h2>
          <p>
            {currentEvent
              ? "You can explore the other events. Each artist competes in one event during this pilot."
              : "Choose your challenge in the 64-artist, four-event pilot. Your event room shows when to submit your one tournament track."}
          </p>
          <div className="artist-event-grid">
            {visibleEvents.length > 0 ? (
              visibleEvents.map((event) => (
                <button
                  className={selectedEventId === event.id ? "artist-event-tile is-active" : "artist-event-tile"}
                  disabled={!!currentEntry}
                  key={event.id}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setAcceptBetaRules(false);
                  }}
                  type="button"
                >
                  <span>Prize</span>
                  <strong>{money(event.desiredPrizeCents)}</strong>
                  <em>
                    {event.title} | Entry open
                  </em>
                </button>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No open events</strong>
                <span>That portal has no open events right now.</span>
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
                Entry {money(selectedEvent.entryFeeCents)} | Prize{" "}
                {money(selectedEvent.desiredPrizeCents)}
              </span>
            </div>
            <div className="beta-rules-card">
              <strong>Beta event rules</strong>
              <p>
                Battle rap is competitive. Direct bars, punchlines, and talking trash about contenders are allowed.
                Hate speech is not.
              </p>
              <ul>
                <li>No racist hate speech or attacks against protected communities.</li>
                <li>No threats against countries, communities, or real-world groups.</li>
                <li>No credible threats of violence, doxxing, or instructions for harm.</li>
                <li>Submissions must be original, no longer than 3 minutes, and made for the posted challenge.</li>
                <li>Entry is $1 for this beta event. Prize, deadlines, judging, and results are handled by the protocol.</li>
                <li>Judging uses Lyrics 25%, Delivery 20%, Originality 20%, Flow 15%, Impact 20%.</li>
              </ul>
              <TournamentRules />
              <p>Prizes are credited after the shared reveal when eligibility and funding checks pass. Bank payouts are not enabled in this beta.</p>
              <label>
                <input
                  checked={acceptBetaRules || betaRulesAccepted}
                  disabled={betaRulesAccepted}
                  onChange={(event) => setAcceptBetaRules(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {betaRulesAccepted
                    ? "Beta rules accepted for this profile."
                    : "I understand and accept the beta rules for paid event entry."}
                </span>
              </label>
            </div>
            <button
              disabled={isBusy || !!currentEntry || (!acceptBetaRules && !betaRulesAccepted)}
              onClick={() => void joinEvent(selectedEvent.id)}
              type="button"
            >
              {currentEntry ? "Already in an event" : "Join this event"}
            </button>
          </section>
        ) : null}

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Create event</h2>
          <p>
            Artist-created events are planned for a later release. During this pilot, entry,
            wallet, submission, judging, and results flow are being validated.
          </p>
          <button className="artist-room-link secondary" disabled type="button">
            Create event - beta locked
          </button>
        </section>
      </section>
    </main>
  );
}
