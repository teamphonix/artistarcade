"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CHALLENGES } from "@/app/lib/protocol";

type Artist = {
  id: string;
  name: string;
  email: string;
  walletUsd: number;
  rewardUsd?: number;
  paymentStatus?: "pending" | "paid" | "comped";
  status: string;
};

type Submission = {
  id: string;
  artistId: string;
  title: string;
  audioUrl: string;
  challenge: string;
};

type Assignment = {
  id: string;
  judgeArtistId: string;
  submissionId: string;
  round: number;
  status: "assigned" | "completed";
};

type RankedSubmission = Submission & {
  artist?: Artist;
  score: number;
  judgmentCount: number;
};

type PilotPayload = {
  backend: "local" | "supabase";
  state: {
    event: {
      name: string;
      entryFee: number;
      prize: number;
      phase: string;
      capacity: number;
      submissionWindow: string;
      judgingWindow: string;
    };
    artists: Artist[];
    submissions: Submission[];
    judgingAssignments: Assignment[];
  };
  ranked: RankedSubmission[];
};

const initialScores = {
  lyrics: 4,
  delivery: 4,
  originality: 4,
  impact: 4,
};

export default function ArenaPage() {
  const [payload, setPayload] = useState<PilotPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [entry, setEntry] = useState({ name: "", email: "" });
  const [submission, setSubmission] = useState({
    artistId: "",
    title: "",
    audioUrl: "",
    challenge: CHALLENGES[0] as string,
  });
  const [judging, setJudging] = useState({
    judgeArtistId: "",
    submissionId: "",
    ...initialScores,
  });

  async function loadPilot() {
    const response = await fetch("/api/pilot", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Pilot could not load.");
    }

    setPayload(data);
    setSubmission((current) => ({
      ...current,
      artistId: current.artistId || data.state.artists[0]?.id || "",
    }));
    setJudging((current) => ({
      ...current,
      judgeArtistId: current.judgeArtistId || data.state.artists[0]?.id || "",
      submissionId: current.submissionId || data.state.submissions[0]?.id || "",
    }));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPilot()
        .catch((error) => setMessage(error instanceof Error ? error.message : "Pilot could not load."))
        .finally(() => setIsLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function postPilot(action: string, body = {}) {
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

  async function handleEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postPilot("enter", entry);
    setEntry({ name: "", email: "" });
  }

  async function handlePaidEntry() {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout could not start.");
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not start.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postPilot("submit", submission);
  }

  async function handleJudging(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postPilot("judge", judging);
  }

  const selectedJudgeAssignments = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.state.judgingAssignments.filter((assignment) => assignment.judgeArtistId === judging.judgeArtistId);
  }, [judging.judgeArtistId, payload]);

  const activeAssignment = payload?.state.judgingAssignments.find(
    (assignment) => assignment.judgeArtistId === judging.judgeArtistId && assignment.submissionId === judging.submissionId,
  );
  const paidCount = payload?.state.artists.filter((artist) => artist.paymentStatus === "paid").length || 0;
  const enteredCount = payload?.state.artists.length || 0;
  const submittedCount = payload?.state.submissions.length || 0;
  const completedAssignments =
    payload?.state.judgingAssignments.filter((assignment) => assignment.status === "completed").length || 0;
  const totalAssignments = payload?.state.judgingAssignments.length || 0;

  if (isLoading) {
    return <main className="pilot-page">Loading Pilot Ring A...</main>;
  }

  if (!payload) {
    return (
      <main className="pilot-page">
        <p>{message || "Pilot could not load."}</p>
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
          <span className="pilot-kicker">Artist Arcade MVP Protocol</span>
          <h1>{payload.state.event.name}</h1>
          <p>
            48 artist pilot. Entry, submission, judging assignment, elimination, advancement, and reward ledger.
          </p>
        </div>
        <div className="pilot-status">
          <strong>{payload.state.event.phase}</strong>
          <span>{payload.backend === "supabase" ? "Supabase live" : "Local demo mode"}</span>
        </div>
      </section>

      <section className="pilot-metrics" aria-label="Pilot metrics">
        <article>
          <span>Artists</span>
          <strong>
            {enteredCount}/{payload.state.event.capacity}
          </strong>
        </article>
        <article>
          <span>Paid</span>
          <strong>{paidCount}</strong>
        </article>
        <article>
          <span>Submissions</span>
          <strong>{submittedCount}</strong>
        </article>
        <article>
          <span>Judging</span>
          <strong>
            {completedAssignments}/{totalAssignments}
          </strong>
        </article>
        <article>
          <span>Reward</span>
          <strong>${payload.state.event.prize}</strong>
        </article>
      </section>

      {message ? <p className="pilot-message">{message}</p> : null}

      <section className="pilot-grid">
        <form className="pilot-card" onSubmit={handleEntry}>
          <span className="pilot-step">01 Enter</span>
          <h2>Register artist</h2>
          <label>
            Artist name
            <input value={entry.name} onChange={(event) => setEntry({ ...entry, name: event.target.value })} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={entry.email}
              onChange={(event) => setEntry({ ...entry, email: event.target.value })}
            />
          </label>
          <div className="pilot-actions">
            <button disabled={isBusy} type="submit">
              Add demo entry
            </button>
            <button disabled={isBusy} type="button" onClick={handlePaidEntry}>
              Pay ${payload.state.event.entryFee}
            </button>
          </div>
        </form>

        <form className="pilot-card" onSubmit={handleSubmission}>
          <span className="pilot-step">02 Submit</span>
          <h2>Upload performance link</h2>
          <label>
            Artist
            <select
              value={submission.artistId}
              onChange={(event) => setSubmission({ ...submission, artistId: event.target.value })}
            >
              {payload.state.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Challenge
            <select
              value={submission.challenge}
              onChange={(event) => setSubmission({ ...submission, challenge: event.target.value })}
            >
              {CHALLENGES.map((challenge) => (
                <option key={challenge} value={challenge}>
                  {challenge}
                </option>
              ))}
            </select>
          </label>
          <label>
            Track title
            <input value={submission.title} onChange={(event) => setSubmission({ ...submission, title: event.target.value })} />
          </label>
          <label>
            Audio URL
            <input
              value={submission.audioUrl}
              onChange={(event) => setSubmission({ ...submission, audioUrl: event.target.value })}
              placeholder="SoundCloud, Drive, Dropbox, etc."
            />
          </label>
          <button disabled={isBusy} type="submit">
            Save submission
          </button>
        </form>

        <form className="pilot-card" onSubmit={handleJudging}>
          <span className="pilot-step">03 Judge</span>
          <h2>Complete assigned review</h2>
          <label>
            Judge
            <select
              value={judging.judgeArtistId}
              onChange={(event) => setJudging({ ...judging, judgeArtistId: event.target.value, submissionId: "" })}
            >
              {payload.state.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned submission
            <select
              value={judging.submissionId}
              onChange={(event) => setJudging({ ...judging, submissionId: event.target.value })}
            >
              <option value="">Select assignment</option>
              {selectedJudgeAssignments.map((assignment) => {
                const assignedSubmission = payload.state.submissions.find((entry) => entry.id === assignment.submissionId);
                return (
                  <option key={assignment.id} value={assignment.submissionId}>
                    {assignedSubmission?.title || "Untitled"} - {assignment.status}
                  </option>
                );
              })}
            </select>
          </label>
          {(["lyrics", "delivery", "originality", "impact"] as const).map((scoreKey) => (
            <label key={scoreKey}>
              {scoreKey}
              <input
                max="5"
                min="1"
                type="number"
                value={judging[scoreKey]}
                onChange={(event) => setJudging({ ...judging, [scoreKey]: Number(event.target.value) })}
              />
            </label>
          ))}
          <button disabled={isBusy || !activeAssignment} type="submit">
            Submit judgment
          </button>
        </form>

        <section className="pilot-card">
          <span className="pilot-step">04 Operate</span>
          <h2>Protocol controls</h2>
          <button disabled={isBusy} type="button" onClick={() => postPilot("generateAssignments")}>
            Generate judge assignments
          </button>
          <button disabled={isBusy || !payload.ranked[0]?.artist?.id} type="button" onClick={() => postPilot("markWinner", { artistId: payload.ranked[0]?.artist?.id })}>
            Mark current leader winner
          </button>
          {payload.backend === "local" ? (
            <button disabled={isBusy} type="button" onClick={() => postPilot("reset")}>
              Reset demo data
            </button>
          ) : null}
          <p>
            Judging assignments are explicit, so the pilot can track who judged who, who still owes a review, and who
            advances after results.
          </p>
        </section>
      </section>

      <section className="pilot-columns">
        <article className="pilot-panel">
          <h2>Artists and status</h2>
          <div className="pilot-table">
            {payload.state.artists.map((artist) => (
              <div key={artist.id} className="pilot-row">
                <strong>{artist.name}</strong>
                <span>{artist.paymentStatus || "demo"}</span>
                <span>{artist.status}</span>
                <span>${artist.rewardUsd ?? artist.walletUsd}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="pilot-panel">
          <h2>Ranked results</h2>
          <div className="pilot-table">
            {payload.ranked.map((ranked, index) => (
              <div key={ranked.id} className="pilot-row">
                <strong>
                  #{index + 1} {ranked.artist?.name || "Unknown"}
                </strong>
                <span>{ranked.title}</span>
                <span>{ranked.score}%</span>
                <span>{ranked.judgmentCount} reviews</span>
              </div>
            ))}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Judging map</h2>
          <div className="pilot-assignment-grid">
            {payload.state.judgingAssignments.map((assignment) => {
              const judge = payload.state.artists.find((artist) => artist.id === assignment.judgeArtistId);
              const assignedSubmission = payload.state.submissions.find((entry) => entry.id === assignment.submissionId);
              const performer = payload.state.artists.find((artist) => artist.id === assignedSubmission?.artistId);

              return (
                <div key={assignment.id} className="pilot-assignment">
                  <strong>{judge?.name || "Judge"}</strong>
                  <span>reviews {performer?.name || "Artist"}</span>
                  <em>{assignment.status}</em>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}
