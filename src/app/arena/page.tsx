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
  standings: Entry[];
  battles: Battle[];
  assignmentsTotal: number;
  assignmentsCompleted: number;
};

type ProtocolPayload = {
  backend: "local" | "supabase";
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

const hiddenScores = {
  lyrics: 10,
  delivery: 10,
  originality: 10,
  flow: 10,
  impact: 10,
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

export default function ArenaPage() {
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"artist" | "host">("artist");
  const [selectedEventId, setSelectedEventId] = useState("event-1");
  const [artistViewId, setArtistViewId] = useState("artist-1");
  const [deposit, setDeposit] = useState({ name: "", email: "", amountCents: 100 });
  const [join, setJoin] = useState({ artistId: "artist-1", eventId: "event-1" });
  const [submission, setSubmission] = useState({
    artistId: "artist-1",
    eventId: "event-1",
    title: "",
    audioUrl: "",
    durationSeconds: 180,
  });
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [hostJudging, setHostJudging] = useState({
    assignmentId: "",
    selectedWinnerArtistId: "",
  });
  const [artistChoice, setArtistChoice] = useState("");

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
    setArtistViewId((current) => current || firstArtist);
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

  async function uploadSubmissionFile(eventId: string, artistId: string, round: number) {
    if (!submissionFile) {
      return submission.audioUrl.trim();
    }

    const formData = new FormData();
    formData.append("file", submissionFile);
    formData.append("artistId", artistId);
    formData.append("eventId", eventId);
    formData.append("round", String(round));

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Audio upload failed.");
    }

    setUploadLabel(data.fileName || submissionFile.name);
    return String(data.publicUrl || "");
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const activeEventId = submission.eventId;
      const activeArtistId = submission.artistId;
      const activeEvent = payload?.events.find((entry) => entry.id === activeEventId);
      const uploadedAudioUrl = await uploadSubmissionFile(activeEventId, activeArtistId, activeEvent?.currentRound || 1);

      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...submission,
          audioUrl: uploadedAudioUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Protocol action failed.");
      }

      setPayload(data);
      setSubmission((current) => ({ ...current, audioUrl: uploadedAudioUrl }));
      setMessage("Submission saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Protocol action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleHostJudgment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void postProtocol("judge", {
      assignmentId: hostJudging.assignmentId,
      selectedWinnerArtistId: hostJudging.selectedWinnerArtistId,
      scores: hiddenScores,
    });
  }

  function handleArtistVote(event: FormEvent<HTMLFormElement>, assignmentId: string) {
    event.preventDefault();
    if (!artistChoice) {
      return;
    }

    void postProtocol("judge", {
      assignmentId,
      selectedWinnerArtistId: artistChoice,
      scores: hiddenScores,
    });
  }

  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) || payload?.events[0];
  const artistMap = useMemo(() => new Map(payload?.artists.map((artist) => [artist.id, artist]) || []), [payload]);
  const artistEvent = payload?.events.find((event) => event.entries.some((entry) => entry.artistId === artistViewId));
  const artistSubmission = payload?.submissions.find(
    (entry) => entry.artistId === artistViewId && entry.eventId === artistEvent?.id && entry.round === artistEvent?.currentRound,
  );
  const artistAssignment = payload?.assignments.find(
    (assignment) => assignment.judgeArtistId === artistViewId && assignment.status === "assigned",
  );
  const artistBattle = payload?.battles.find((battle) => battle.id === artistAssignment?.battleId);
  const availableAssignments = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.assignments.filter((assignment) => assignment.status === "assigned");
  }, [payload]);
  const selectedAssignment = payload?.assignments.find((assignment) => assignment.id === hostJudging.assignmentId);
  const selectedBattle = payload?.battles.find((battle) => battle.id === selectedAssignment?.battleId);
  const battleSubmission = (eventId: string | undefined, artistId: string | undefined, round: number | undefined) =>
    payload?.submissions.find(
      (entry) => entry.eventId === eventId && entry.artistId === artistId && entry.round === round,
    );
  const artistBattleSubmissions = artistBattle
    ? [
        battleSubmission(artistBattle.eventId, artistBattle.artistAId, artistBattle.round),
        battleSubmission(artistBattle.eventId, artistBattle.artistBId, artistBattle.round),
      ]
    : [];
  const hostBattleSubmissions = selectedBattle
    ? [
        battleSubmission(selectedBattle.eventId, selectedBattle.artistAId, selectedBattle.round),
        battleSubmission(selectedBattle.eventId, selectedBattle.artistBId, selectedBattle.round),
      ]
    : [];

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
          <h1>{viewMode === "artist" ? "Artist Arena" : "Host Console"}</h1>
          <p>
            {viewMode === "artist"
              ? "From the artist side this feels simple: put up $1, submit your track, decide who was better when called, and wait for the final reveal."
              : "Host mode exposes the full engine: event queues, hidden bracket state, cross-event judging assignments, progression, and payout control."}
          </p>
        </div>
        <div className="pilot-status">
          <strong>{viewMode === "artist" ? "1 in 5" : payload.backend}</strong>
          <span>{payload.settings.judgingWindowMinutes} min decision window</span>
        </div>
      </section>

      <section className="pilot-metrics" aria-label="Protocol metrics">
        <article>
          <span>Entry</span>
          <strong>$1</strong>
        </article>
        <article>
          <span>Prize</span>
          <strong>$5</strong>
        </article>
        <article>
          <span>Events</span>
          <strong>{payload.settings.eventCount}</strong>
        </article>
        <article>
          <span>Judging</span>
          <strong>
            {payload.totals.completedAssignments}/{payload.totals.assignments}
          </strong>
        </article>
        <article>
          <span>Reveal</span>
          <strong>{payload.totals.completedBattles}/60</strong>
        </article>
      </section>

      {message ? <p className="pilot-message">{message}</p> : null}

      <section className="pilot-view-switch" aria-label="View mode">
        <button
          className={viewMode === "artist" ? "is-active" : ""}
          onClick={() => setViewMode("artist")}
          type="button"
        >
          Artist Side
        </button>
        <button className={viewMode === "host" ? "is-active" : ""} onClick={() => setViewMode("host")} type="button">
          Host Side
        </button>
      </section>

      {viewMode === "artist" ? (
        <>
          <section className="pilot-grid artist-grid">
            <article className="pilot-card artist-card">
              <span className="pilot-step">01 Identity</span>
              <h2>Demo artist</h2>
              <label>
                Artist profile
                <select value={artistViewId} onChange={(event) => setArtistViewId(event.target.value)}>
                  {payload.artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="artist-stat-stack">
                <span>Wallet {money(artistMap.get(artistViewId)?.walletCents || 0)}</span>
                <span>Status {artistMap.get(artistViewId)?.status || "waiting"}</span>
                <span>Event {artistEvent?.title || "Not entered yet"}</span>
              </div>
            </article>

            <article className="pilot-card artist-card">
              <span className="pilot-step">02 Event</span>
              <h2>1 in 5 wins the prize</h2>
              <p>
                Enter the event with $1. Submit your track when the challenge opens. If your work keeps getting chosen
                as the stronger submission, you stay alive until the final reveal.
              </p>
              <div className="artist-stat-stack">
                <span>Prize {money(artistEvent?.desiredPrizeCents || 500)}</span>
                <span>Current challenge {artistEvent?.challengeTitle || selectedEvent.challengeTitle}</span>
                <span>Submission clock {relativeCountdown(artistEvent?.submissionDeadline || null)}</span>
              </div>
            </article>

            <form className="pilot-card artist-card" onSubmit={handleSubmission}>
              <span className="pilot-step">03 Submit</span>
              <h2>Your track</h2>
              <label>
                Event
                <select
                  value={submission.eventId}
                  onChange={(event) => setSubmission({ ...submission, eventId: event.target.value })}
                >
                  {payload.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input value={submission.title} onChange={(event) => setSubmission({ ...submission, title: event.target.value })} />
              </label>
              <label>
                Upload audio
                <input
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                  onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                  type="file"
                />
              </label>
              <p className="artist-muted">
                {submissionFile ? `Ready to upload: ${submissionFile.name}` : uploadLabel ? `Uploaded: ${uploadLabel}` : "Choose your submission file."}
              </p>
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
              <button
                disabled={isBusy}
                onClick={() => setSubmission((current) => ({ ...current, artistId: artistViewId, eventId: artistEvent?.id || current.eventId }))}
                type="submit"
              >
                Save submission
              </button>
              <p className="artist-muted">
                {artistSubmission ? `Saved: ${artistSubmission.title}` : "No current round submission saved yet."}
              </p>
            </form>
          </section>

          <section className="artist-flow-grid">
            <article className="pilot-panel artist-panel">
              <h2>State</h2>
              <div className="artist-wait-card">
                <strong>
                  {artistAssignment
                    ? "Decision ready"
                    : artistEvent?.phase === "complete"
                      ? "Final reveal pending"
                      : artistEvent?.phase === "judging"
                        ? "Judging wave active"
                        : "Awaiting next matchup"}
                </strong>
                <p>
                  {artistAssignment
                    ? "Your judgment card was issued with the rest of the wave. The timer is already live, so compare both tracks and make your choice before it expires."
                    : artistEvent?.phase === "judging"
                      ? "Judging cards were released at the same time for this wave. If you did not receive one, stay on standby until the next distribution."
                      : "Arena recalibrating. Stay ready. Your next assignment appears only when the system needs your vote."}
                </p>
                <span>
                  {artistAssignment ? `Decision window ${relativeCountdown(artistAssignment.dueAt)}` : "Stand by for next call"}
                </span>
              </div>
            </article>

            <article className="pilot-panel artist-panel">
              <h2>Duty Cycle</h2>
              <div className="artist-duty">
                {[1, 2, 3, 4].map((round) => {
                  const roundDone = payload.judgments.some((judgment) => {
                    const assignment = payload.assignments.find((entry) => entry.id === judgment.assignmentId);
                    const battle = payload.battles.find((entry) => entry.id === assignment?.battleId);
                    return judgment.judgeArtistId === artistViewId && battle?.round === round;
                  });

                  return (
                    <div className="artist-duty-step" key={round}>
                      <strong>Round {round}</strong>
                      <span>{roundDone ? "Decision made" : "Waiting"}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="artist-judge-surface">
            <form
              className="artist-binary-card"
              key={artistAssignment?.id || "waiting"}
              onSubmit={(event) => handleArtistVote(event, artistAssignment?.id || "")}
            >
              <span className="pilot-step">04 Judge</span>
              <h2>{artistAssignment ? "Who felt stronger?" : "No active matchup"}</h2>
              {artistAssignment && artistBattle ? (
                <>
                  <div className="artist-versus">
                    {[artistBattle.artistAId, artistBattle.artistBId].map((artistId, index) => {
                      const submissionEntry = artistBattleSubmissions[index];

                      return (
                        <button
                          className={artistChoice === artistId ? "is-picked" : ""}
                          key={artistId}
                          onClick={() => setArtistChoice(artistId)}
                          type="button"
                        >
                          <span>Artist</span>
                          <strong>{artistMap.get(artistId)?.name}</strong>
                          <em>{submissionEntry?.title || "Submission pending"}</em>
                          {submissionEntry?.audioUrl ? (
                            <audio controls controlsList="nodownload" preload="none" src={submissionEntry.audioUrl} />
                          ) : (
                            <small>Track not uploaded yet.</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="artist-judge-actions">
                    <button disabled={isBusy || !artistChoice} type="submit">
                      Submit decision
                    </button>
                  </div>
                </>
              ) : (
                <div className="artist-empty-state">
                  <strong>Arena recalibrating...</strong>
                  <span>Next matchup being prepared.</span>
                </div>
              )}
            </form>
          </section>
        </>
      ) : (
        <>
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
              <h2>Join hidden bracket</h2>
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
                Host view keeps the real queue visible. Front end never shows the 16-artist structure to participants.
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
                Upload audio
                <input
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                  onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                  type="file"
                />
              </label>
              <p className="artist-muted">
                {submissionFile ? `Ready to upload: ${submissionFile.name}` : uploadLabel ? `Uploaded: ${uploadLabel}` : "Choose an audio file for this round."}
              </p>
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
              <h2>Assignment engine</h2>
              <p>
                Secret sauce stays here: synchronized judging waves, cross-event constraints, one active card per artist,
                and automatic resolution if a timer burns out.
              </p>
              <button
                disabled={isBusy || selectedEvent.phase === "queue"}
                onClick={() => postProtocol("generateJudgeAssignments", { eventId: selectedEvent.id })}
                type="button"
              >
                Distribute judging wave
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
                <span>Queued: {selectedEvent.queuedCount}/16</span>
                <span>Submission deadline: {shortTime(selectedEvent.submissionDeadline)}</span>
                <span>Judging deadline: {shortTime(selectedEvent.judgingDeadline)}</span>
                <span>Challenge audio: {selectedEvent.challengeAudioUrl}</span>
              </div>
              <p>{selectedEvent.challengeDescription}</p>
            </article>

            <form className="pilot-panel" onSubmit={handleHostJudgment}>
              <h2>Host judgment override</h2>
              <label>
                Assignment
                <select
                  value={hostJudging.assignmentId}
                  onChange={(event) => {
                    const assignment = payload.assignments.find((entry) => entry.id === event.target.value);
                    const battle = payload.battles.find((entry) => entry.id === assignment?.battleId);
                    setHostJudging({
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
              {selectedAssignment?.dueAt ? <p className="artist-muted">Wave timer: {relativeCountdown(selectedAssignment.dueAt)}</p> : null}
              {selectedBattle ? (
                <div className="judge-playback-grid">
                  {[selectedBattle.artistAId, selectedBattle.artistBId].map((artistId, index) => {
                    const submissionEntry = hostBattleSubmissions[index];

                    return (
                      <div className="judge-playback-card" key={artistId}>
                        <span>Contestant</span>
                        <strong>{artistMap.get(artistId)?.name}</strong>
                        <em>{submissionEntry?.title || "Submission pending"}</em>
                        {submissionEntry?.audioUrl ? (
                          <audio controls controlsList="nodownload" preload="none" src={submissionEntry.audioUrl} />
                        ) : (
                          <small>Track not uploaded yet.</small>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <label>
                Winner
                <select
                  value={hostJudging.selectedWinnerArtistId}
                  onChange={(event) => setHostJudging({ ...hostJudging, selectedWinnerArtistId: event.target.value })}
                >
                  {selectedBattle ? (
                    <>
                      <option value={selectedBattle.artistAId}>{artistMap.get(selectedBattle.artistAId)?.name}</option>
                      <option value={selectedBattle.artistBId}>{artistMap.get(selectedBattle.artistBId)?.name}</option>
                    </>
                  ) : null}
                </select>
              </label>
              <button disabled={isBusy || !selectedBattle} type="submit">
                Submit binary decision
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
                      {entry.wins || 0}-{entry.losses || 0}
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
        </>
      )}
    </main>
  );
}
