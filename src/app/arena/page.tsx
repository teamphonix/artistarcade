"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  artist?: Artist;
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
  openedAt: string | null;
  dueAt: string | null;
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
  companyRevenueCents: number;
  entries: Entry[];
  standings: Array<Entry & { wins: number; losses: number }>;
  battles: Battle[];
  assignmentsTotal: number;
  assignmentsCompleted: number;
};

type ProtocolPayload = {
  backend: "local";
  settings: {
    artistsPerEvent: number;
    eventCount: number;
    totalArtists: number;
    submissionLimitSeconds: number;
    submissionWindowHours: number;
    judgingWindowMinutes: number;
    judgesPerBattle: number;
  };
  artists: Artist[];
  events: EventSummary[];
  submissions: Array<{
    id: string;
    eventId: string;
    artistId: string;
    round: number;
    title: string;
    audioUrl: string;
    durationSeconds: number;
  }>;
  battles: Battle[];
  assignments: Assignment[];
  judgments: Array<{
    id: string;
    assignmentId: string;
    battleId: string;
    judgeArtistId: string;
    selectedWinnerArtistId: string;
  }>;
  totals: {
    artists: number;
    eventCapacity: number;
    entries: number;
    submissions: number;
    totalBattlesFullBracket: number;
    completedBattles: number;
    assignments: number;
    completedAssignments: number;
    companyRevenueCents: number;
  };
  scoreCategories: Array<{ key: string; label: string; weight: number }>;
};

const defaultScores = {
  lyrics: 8,
  delivery: 8,
  originality: 8,
  flow: 8,
  impact: 8,
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

export default function ArenaPage() {
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("event-1");
  const [deposit, setDeposit] = useState({ name: "", email: "", amountCents: 10000 });
  const [join, setJoin] = useState({ artistId: "artist-1", eventId: "event-1" });
  const [submission, setSubmission] = useState({
    artistId: "artist-1",
    eventId: "event-1",
    title: "",
    audioUrl: "",
    durationSeconds: 180,
  });
  const [judging, setJudging] = useState({
    assignmentId: "",
    selectedWinnerArtistId: "",
    scores: defaultScores,
  });

  async function loadProtocol() {
    const response = await fetch("/api/pilot", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Protocol could not load.");
    }

    setPayload(data);
    const firstEvent = data.events[0]?.id || "event-1";
    const firstArtist = data.artists[0]?.id || "";
    setSelectedEventId((current) => current || firstEvent);
    setJoin((current) => ({ ...current, artistId: current.artistId || firstArtist, eventId: current.eventId || firstEvent }));
    setSubmission((current) => ({
      ...current,
      artistId: current.artistId || firstArtist,
      eventId: current.eventId || firstEvent,
    }));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProtocol()
        .catch((error) => setMessage(error instanceof Error ? error.message : "Protocol could not load."))
        .finally(() => setIsLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
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
      setMessage("Protocol updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Protocol action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void postProtocol("deposit", deposit);
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void postProtocol("joinEvent", join);
  }

  function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void postProtocol("submit", submission);
  }

  function handleJudgment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void postProtocol("judge", judging);
  }

  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) || payload?.events[0];
  const availableAssignments = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.assignments.filter((assignment) => assignment.status === "assigned" || assignment.status === "opened");
  }, [payload]);
  const selectedAssignment = payload?.assignments.find((assignment) => assignment.id === judging.assignmentId);
  const selectedBattle = payload?.battles.find((battle) => battle.id === selectedAssignment?.battleId);
  const artistMap = useMemo(() => new Map(payload?.artists.map((artist) => [artist.id, artist]) || []), [payload]);

  if (isLoading) {
    return <main className="pilot-page">Loading battle protocol...</main>;
  }

  if (!payload || !selectedEvent) {
    return (
      <main className="pilot-page">
        <p>{message || "Protocol could not load."}</p>
        <Link href="/">Return to portal</Link>
      </main>
    );
  }

  return (
    <main className="pilot-page">
      <section className="pilot-hero">
        <Link href="/" className="pilot-back">
          Return to portal
        </Link>
        <div>
          <span className="pilot-kicker">Artist Arcade Battle Protocol</span>
          <h1>64 Artist MVP</h1>
          <p>
            Four 16-artist rap events. Single elimination. Four rounds per bracket. Outside-event judging only. Winner
            receives the desired prize, and the remainder is company revenue.
          </p>
        </div>
        <div className="pilot-status">
          <strong>{payload.backend}</strong>
          <span>{payload.settings.judgingWindowMinutes} min judging timer</span>
        </div>
      </section>

      <section className="pilot-metrics" aria-label="Protocol metrics">
        <article>
          <span>Artists</span>
          <strong>
            {payload.totals.entries}/{payload.totals.eventCapacity}
          </strong>
        </article>
        <article>
          <span>Events</span>
          <strong>{payload.settings.eventCount}</strong>
        </article>
        <article>
          <span>Full bracket battles</span>
          <strong>{payload.totals.totalBattlesFullBracket}</strong>
        </article>
        <article>
          <span>Judging</span>
          <strong>
            {payload.totals.completedAssignments}/{payload.totals.assignments}
          </strong>
        </article>
        <article>
          <span>Company rev</span>
          <strong>{money(payload.totals.companyRevenueCents)}</strong>
        </article>
      </section>

      {message ? <p className="pilot-message">{message}</p> : null}

      <section className="pilot-tabs" aria-label="MVP events">
        {payload.events.map((event) => (
          <button
            className={event.id === selectedEvent.id ? "is-active" : ""}
            key={event.id}
            onClick={() => {
              setSelectedEventId(event.id);
              setJoin((current) => ({ ...current, eventId: event.id }));
              setSubmission((current) => ({ ...current, eventId: event.id }));
            }}
            type="button"
          >
            {event.title}
          </button>
        ))}
      </section>

      <section className="pilot-grid protocol-grid">
        <form className="pilot-card" onSubmit={handleDeposit}>
          <span className="pilot-step">01 Wallet</span>
          <h2>Deposit funds</h2>
          <label>
            Artist name
            <input value={deposit.name} onChange={(event) => setDeposit({ ...deposit, name: event.target.value })} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={deposit.email}
              onChange={(event) => setDeposit({ ...deposit, email: event.target.value })}
            />
          </label>
          <label>
            Amount
            <input
              min="100"
              step="100"
              type="number"
              value={deposit.amountCents}
              onChange={(event) => setDeposit({ ...deposit, amountCents: Number(event.target.value) })}
            />
          </label>
          <button disabled={isBusy} type="submit">
            Add wallet funds
          </button>
        </form>

        <form className="pilot-card" onSubmit={handleJoin}>
          <span className="pilot-step">02 Queue</span>
          <h2>Join 16-artist event</h2>
          <label>
            Artist
            <select value={join.artistId} onChange={(event) => setJoin({ ...join, artistId: event.target.value })}>
              {payload.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name} - {money(artist.walletCents)}
                </option>
              ))}
            </select>
          </label>
          <p>
            {selectedEvent.queuedCount}/16 queued. Entry is {money(selectedEvent.entryFeeCents)}, which is one fifth of
            the {money(selectedEvent.desiredPrizeCents)} prize.
          </p>
          <button disabled={isBusy || selectedEvent.phase !== "queue"} type="submit">
            Join selected event
          </button>
          <button
            disabled={isBusy || selectedEvent.queuedCount !== 16}
            onClick={() => postProtocol("closeQueue", { eventId: selectedEvent.id })}
            type="button"
          >
            Close queue and start 24h clock
          </button>
        </form>

        <form className="pilot-card" onSubmit={handleSubmission}>
          <span className="pilot-step">03 Submission</span>
          <h2>Upload round entree</h2>
          <label>
            Artist
            <select
              value={submission.artistId}
              onChange={(event) => setSubmission({ ...submission, artistId: event.target.value })}
            >
              {selectedEvent.entries.map((entry) => (
                <option key={entry.id} value={entry.artistId}>
                  {entry.artist?.name || entry.artistId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Track title
            <input value={submission.title} onChange={(event) => setSubmission({ ...submission, title: event.target.value })} />
          </label>
          <label>
            MP3 or audio URL
            <input value={submission.audioUrl} onChange={(event) => setSubmission({ ...submission, audioUrl: event.target.value })} />
          </label>
          <label>
            Length in seconds
            <input
              max={payload.settings.submissionLimitSeconds}
              min="1"
              type="number"
              value={submission.durationSeconds}
              onChange={(event) => setSubmission({ ...submission, durationSeconds: Number(event.target.value) })}
            />
          </label>
          <button disabled={isBusy || selectedEvent.phase === "queue"} type="submit">
            Save submission
          </button>
        </form>

        <section className="pilot-card">
          <span className="pilot-step">04 Assign</span>
          <h2>Cross-event judges</h2>
          <p>
            Judges are pulled from other events only. They cannot judge a battle in their own event or a battle involving
            their own submission.
          </p>
          <button
            disabled={isBusy || selectedEvent.phase === "queue"}
            onClick={() => postProtocol("generateJudgeAssignments", { eventId: selectedEvent.id })}
            type="button"
          >
            Generate assignments
          </button>
          <button disabled={isBusy} onClick={() => postProtocol("finalizeRound", { eventId: selectedEvent.id })} type="button">
            Finalize round
          </button>
          <button disabled={isBusy} onClick={() => postProtocol("reset")} type="button">
            Reset demo
          </button>
        </section>
      </section>

      <section className="pilot-columns">
        <article className="pilot-panel">
          <h2>{selectedEvent.title} protocol</h2>
          <div className="protocol-summary">
            <span>Phase: {selectedEvent.phase}</span>
            <span>Round: {selectedEvent.currentRound}</span>
            <span>Submission deadline: {shortTime(selectedEvent.submissionDeadline)}</span>
            <span>Judging deadline: {shortTime(selectedEvent.judgingDeadline)}</span>
            <span>Challenge audio: {selectedEvent.challengeAudioUrl}</span>
          </div>
          <p>{selectedEvent.challengeDescription}</p>
        </article>

        <form className="pilot-panel" onSubmit={handleJudgment}>
          <h2>Cast assigned vote</h2>
          <label>
            Assignment
            <select
              value={judging.assignmentId}
              onChange={(event) => {
                const assignment = payload.assignments.find((entry) => entry.id === event.target.value);
                const battle = payload.battles.find((entry) => entry.id === assignment?.battleId);
                setJudging({
                  ...judging,
                  assignmentId: event.target.value,
                  selectedWinnerArtistId: battle?.artistAId || "",
                });
              }}
            >
              <option value="">Select assignment</option>
              {availableAssignments.map((assignment) => {
                const battle = payload.battles.find((entry) => entry.id === assignment.battleId);
                return (
                  <option key={assignment.id} value={assignment.id}>
                    {artistMap.get(assignment.judgeArtistId)?.name} judges {artistMap.get(battle?.artistAId || "")?.name} vs{" "}
                    {artistMap.get(battle?.artistBId || "")?.name}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            disabled={isBusy || !judging.assignmentId}
            onClick={() => postProtocol("openAssignment", { assignmentId: judging.assignmentId })}
            type="button"
          >
            Open 15-minute timer
          </button>
          <label>
            Winner
            <select
              value={judging.selectedWinnerArtistId}
              onChange={(event) => setJudging({ ...judging, selectedWinnerArtistId: event.target.value })}
            >
              {selectedBattle ? (
                <>
                  <option value={selectedBattle.artistAId}>{artistMap.get(selectedBattle.artistAId)?.name}</option>
                  <option value={selectedBattle.artistBId}>{artistMap.get(selectedBattle.artistBId)?.name}</option>
                </>
              ) : null}
            </select>
          </label>
          {payload.scoreCategories.map((category) => (
            <label key={category.key}>
              {category.label} ({category.weight}%)
              <input
                max="10"
                min="1"
                type="number"
                value={judging.scores[category.key as keyof typeof defaultScores]}
                onChange={(event) =>
                  setJudging({
                    ...judging,
                    scores: { ...judging.scores, [category.key]: Number(event.target.value) },
                  })
                }
              />
            </label>
          ))}
          <button disabled={isBusy || !selectedBattle} type="submit">
            Submit vote
          </button>
        </form>

        <article className="pilot-panel">
          <h2>Queue and standings</h2>
          <div className="pilot-table">
            {selectedEvent.standings.map((entry) => (
              <div className="pilot-row" key={entry.id}>
                <strong>
                  #{entry.seed} {entry.artist?.name}
                </strong>
                <span>{entry.status}</span>
                <span>
                  {entry.wins}-{entry.losses}
                </span>
                <span>{money(entry.paidCents)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="pilot-panel">
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

        <article className="pilot-panel pilot-panel-wide">
          <h2>Artist wallets</h2>
          <div className="pilot-assignment-grid">
            {payload.artists.slice(0, 64).map((artist) => (
              <div className="pilot-assignment" key={artist.id}>
                <strong>{artist.name}</strong>
                <span>{artist.status}</span>
                <em>
                  Wallet {money(artist.walletCents)} / Rewards {money(artist.rewardCents)}
                </em>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
