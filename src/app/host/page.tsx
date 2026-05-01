"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Artist = {
  id: string;
  name: string;
  walletCents: number;
  rewardCents: number;
  status: string;
};

type Entry = {
  id: string;
  artistId: string;
  seed: number;
  status: string;
  paidCents: number;
  artist?: Artist;
  wins?: number;
  losses?: number;
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

type EventSummary = {
  id: string;
  title: string;
  desiredPrizeCents: number;
  entryFeeCents: number;
  challengeTitle: string;
  challengeDescription: string;
  challengeAudioUrl: string;
  phase: string;
  currentRound: number;
  queuedCount: number;
  openSlots: number;
  grossPotCents: number;
  projectedCompanyCents: number;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  winnerArtistId: string | null;
  entries: Entry[];
  standings: Entry[];
  battles: Battle[];
};

type ProtocolPayload = {
  backend: "local" | "supabase";
  artists: Artist[];
  events: EventSummary[];
  totals: {
    artists: number;
    entries: number;
    submissions: number;
    completedBattles: number;
    assignments: number;
    completedAssignments: number;
    companyRevenueCents: number;
  };
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

export default function HostPage() {
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const [beatUploadLabel, setBeatUploadLabel] = useState("");
  const [eventDraft, setEventDraft] = useState({
    challengeTitle: "",
    challengeDescription: "",
    challengeAudioUrl: "",
  });

  function applyEventDraft(event: EventSummary | null) {
    if (!event) {
      return;
    }

    setEventDraft({
      challengeTitle: event.challengeTitle,
      challengeDescription: event.challengeDescription,
      challengeAudioUrl: event.challengeAudioUrl,
    });
    setBeatUploadLabel("");
    setBeatFile(null);
  }

  function syncPayload(data: ProtocolPayload) {
    const nextSelectedEventId = selectedEventId || data.events[0]?.id || "";
    const nextSelectedEvent = data.events.find((event) => event.id === nextSelectedEventId) || data.events[0] || null;

    setPayload(data);
    setSelectedEventId(nextSelectedEvent?.id || "");
    applyEventDraft(nextSelectedEvent);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function start() {
        try {
          const response = await fetch("/api/pilot", { cache: "no-store" });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Host control room could not load.");
          }

          const nextSelectedEvent = data.events[0] || null;
          setPayload(data);
          setSelectedEventId(nextSelectedEvent?.id || "");
          applyEventDraft(nextSelectedEvent);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Host control room could not load.");
        } finally {
          setIsLoading(false);
        }
      }

      void start();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) || payload?.events[0] || null;

  const artistMap = useMemo(() => new Map(payload?.artists.map((artist) => [artist.id, artist]) || []), [payload]);

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
        throw new Error(data.error || "Host action failed.");
      }

      syncPayload(data);
      setMessage("Host control room updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Host action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadBeatFile(eventId: string) {
    if (!beatFile) {
      return eventDraft.challengeAudioUrl.trim();
    }

    const formData = new FormData();
    formData.append("file", beatFile);
    formData.append("artistId", "host-control");
    formData.append("eventId", eventId);
    formData.append("round", "challenge");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Beat upload failed.");
    }

    setBeatUploadLabel(data.fileName || beatFile.name);
    return String(data.publicUrl || "");
  }

  async function handleEventSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEvent) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const challengeAudioUrl = await uploadBeatFile(selectedEvent.id);
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateEvent",
          eventId: selectedEvent.id,
          challengeTitle: eventDraft.challengeTitle,
          challengeDescription: eventDraft.challengeDescription,
          challengeAudioUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Event update failed.");
      }

      syncPayload(data);
      setEventDraft((current) => ({ ...current, challengeAudioUrl }));
      setMessage("Event challenge updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Event update failed.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return <main className="pilot-page">Loading host control room...</main>;
  }

  if (!payload || !selectedEvent) {
    return (
      <main className="pilot-page">
        <p>{message || "Host control room could not load."}</p>
        <Link href="/arena">Return to arena</Link>
      </main>
    );
  }

  return (
    <main className="pilot-page">
      <section className="pilot-hero">
        <Link className="pilot-back" href="/arena">
          Return to arena
        </Link>
        <div>
          <span className="pilot-kicker">Host Control Room</span>
          <h1>Event Forge</h1>
          <p>
            This is your side of the protocol. Set the beat, write the challenge, watch queues fill, and trigger each
            phase when the event is ready to move.
          </p>
        </div>
        <div className="pilot-status">
          <strong>{payload.backend}</strong>
          <span>4 event pilot</span>
        </div>
      </section>

      {message ? <p className="pilot-message">{message}</p> : null}

      <section className="pilot-metrics" aria-label="Host metrics">
        <article>
          <span>Artists</span>
          <strong>{payload.totals.artists}</strong>
        </article>
        <article>
          <span>Entries</span>
          <strong>{payload.totals.entries}</strong>
        </article>
        <article>
          <span>Submissions</span>
          <strong>{payload.totals.submissions}</strong>
        </article>
        <article>
          <span>Judging</span>
          <strong>
            {payload.totals.completedAssignments}/{payload.totals.assignments}
          </strong>
        </article>
        <article>
          <span>Revenue</span>
          <strong>{money(payload.totals.companyRevenueCents)}</strong>
        </article>
      </section>

      <section className="pilot-tabs" aria-label="Host events">
        {payload.events.map((event) => (
          <button
            className={event.id === selectedEvent.id ? "is-active" : ""}
            key={event.id}
            onClick={() => {
              setSelectedEventId(event.id);
              applyEventDraft(event);
            }}
            type="button"
          >
            {event.title}
          </button>
        ))}
      </section>

      <section className="pilot-columns">
        <form className="pilot-panel" onSubmit={handleEventSave}>
          <h2>Challenge setup</h2>
          <label>
            Challenge title
            <input
              value={eventDraft.challengeTitle}
              onChange={(event) => setEventDraft((current) => ({ ...current, challengeTitle: event.target.value }))}
            />
          </label>
          <label>
            Challenge description
            <input
              value={eventDraft.challengeDescription}
              onChange={(event) =>
                setEventDraft((current) => ({ ...current, challengeDescription: event.target.value }))
              }
            />
          </label>
          <label>
            Upload beat
            <input
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
              onChange={(event) => setBeatFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          <p className="artist-muted">
            {beatFile
              ? `Ready to upload: ${beatFile.name}`
              : beatUploadLabel
                ? `Uploaded: ${beatUploadLabel}`
                : selectedEvent.challengeAudioUrl
                  ? "Beat already attached to this event."
                  : "No beat uploaded yet."}
          </p>
          <label>
            Beat URL
            <input
              value={eventDraft.challengeAudioUrl}
              onChange={(event) => setEventDraft((current) => ({ ...current, challengeAudioUrl: event.target.value }))}
            />
          </label>
          <button disabled={isBusy} type="submit">
            Save event challenge
          </button>
        </form>

        <article className="pilot-panel">
          <h2>Live event status</h2>
          <div className="protocol-summary">
            <span>Phase: {selectedEvent.phase}</span>
            <span>Round: {selectedEvent.currentRound}</span>
            <span>Queue: {selectedEvent.queuedCount}/16</span>
            <span>Submission deadline: {shortTime(selectedEvent.submissionDeadline)}</span>
            <span>Judging deadline: {shortTime(selectedEvent.judgingDeadline)}</span>
            <span>Countdown: {relativeCountdown(selectedEvent.submissionDeadline || selectedEvent.judgingDeadline)}</span>
          </div>
          <p>{selectedEvent.challengeDescription}</p>
          <a className="artist-room-link secondary" href={selectedEvent.challengeAudioUrl} rel="noreferrer" target="_blank">
            Open current beat
          </a>
        </article>

        <article className="pilot-panel">
          <h2>Run the protocol</h2>
          <p>
            Once the queue hits 16, lock it and start the 24-hour submission window. When every active artist has
            submitted, distribute the judging wave. After a round resolves, finalize it to move the winners forward.
          </p>
          <button
            disabled={isBusy || selectedEvent.queuedCount !== 16 || selectedEvent.phase !== "queue"}
            onClick={() => void postProtocol("closeQueue", { eventId: selectedEvent.id })}
            type="button"
          >
            Lock queue and start submission clock
          </button>
          <button
            disabled={isBusy || selectedEvent.phase === "queue"}
            onClick={() => void postProtocol("generateJudgeAssignments", { eventId: selectedEvent.id })}
            type="button"
          >
            Distribute judging wave
          </button>
          <button
            disabled={isBusy}
            onClick={() => void postProtocol("finalizeRound", { eventId: selectedEvent.id })}
            type="button"
          >
            Finalize round
          </button>
          <button disabled={isBusy} onClick={() => void postProtocol("reset")} type="button">
            Reset pilot
          </button>
        </article>

        <article className="pilot-panel">
          <h2>Queue and standings</h2>
          <div className="pilot-table">
            {selectedEvent.standings.map((entry) => (
              <div className="pilot-row" key={entry.id}>
                <strong>
                  #{entry.seed} {entry.artist?.name || artistMap.get(entry.artistId)?.name}
                </strong>
                <span>{entry.status}</span>
                <span>
                  {entry.wins || 0}-{entry.losses || 0}
                </span>
                <span>{money(entry.paidCents)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Round battles</h2>
          <div className="pilot-table">
            {selectedEvent.battles.map((battle) => (
              <div className="pilot-row" key={battle.id}>
                <strong>
                  R{battle.round}.{battle.slot}
                </strong>
                <span>
                  {artistMap.get(battle.artistAId)?.name} vs {artistMap.get(battle.artistBId)?.name}
                </span>
                <span>{battle.status}</span>
                <span>{battle.winnerArtistId ? artistMap.get(battle.winnerArtistId)?.name : "TBD"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
