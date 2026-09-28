"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FateMeter from "@/app/components/FateMeter";
import { aggregateFromSliders, evenSliders, type SliderMap } from "@/app/lib/scoring";

type Artist = {
  id: string;
  name: string;
  walletCents: number;
  rewardCents: number;
  status: string;
};

type Battle = {
  id: string;
  eventId: string;
  round: number;
  artistAId: string;
  artistBId: string;
};

type Assignment = {
  id: string;
  battleId: string;
  judgeArtistId: string;
  status: string;
  dueAt: string | null;
};

type MatchSubmission = {
  id: string;
  eventId: string;
  artistId: string;
  round: number;
  title: string;
  audioUrl: string;
  durationSeconds: number;
};

type ScoreCategory = {
  key: "lyrics" | "delivery" | "originality" | "flow" | "impact";
  label: string;
  weight: number;
};

type EventSummary = {
  id: string;
  title: string;
  challengeTitle: string;
  challengeDescription: string;
  challengeAudioUrl: string;
  phase: string;
  currentRound: number;
  queueClosedAt: string | null;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  entries: Array<{ artistId: string }>;
};

type ProtocolPayload = {
  artists: Artist[];
  events: EventSummary[];
  battles: Battle[];
  assignments: Assignment[];
  submissions: MatchSubmission[];
  scoreCategories: ScoreCategory[];
};

type Scorecard = Record<ScoreCategory["key"], number>;
type ContestantScores = Record<string, Scorecard>;

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

function defaultScorecard(categories: ScoreCategory[] = []) {
  return categories.reduce(
    (scorecard, category) => ({
      ...scorecard,
      [category.key]: 5,
    }),
    {} as Scorecard,
  );
}

function weightedTotal(scorecard: Scorecard | undefined, categories: ScoreCategory[] = []) {
  if (!scorecard) {
    return 0;
  }

  return Math.round(
    categories.reduce((sum, category) => {
      const score = Math.min(10, Math.max(1, Number(scorecard[category.key] || 1)));
      return sum + score * category.weight;
    }, 0) / 10,
  );
}

export default function ArtistEventRoomPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId;
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [file, setFile] = useState<File | null>(null);
  const [sliders, setSliders] = useState<SliderMap>(evenSliders());
  const [judgmentEvents, setJudgmentEvents] = useState<Array<Record<string, unknown>>>([]);
  const [playedOnce, setPlayedOnce] = useState<Record<string, boolean>>({});
  const [cardDeadlineAt, setCardDeadlineAt] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [playingSubmissionId, setPlayingSubmissionId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const assignmentIdRef = useRef<string | null>(null);

  const syncPayloadState = useCallback((data: ProtocolPayload) => {
    const nextAssignmentId =
      data.assignments.find((entry) => entry.judgeArtistId === artistId && entry.status === "assigned")?.id || null;

    if (nextAssignmentId !== assignmentIdRef.current) {
      assignmentIdRef.current = nextAssignmentId;
      setSliders(evenSliders());
      setJudgmentEvents([]);
      setPlayedOnce({});
      setCardDeadlineAt({});
      setPlayingSubmissionId(null);
      audioRefs.current = {};
    }

    setPayload(data);
  }, [artistId]);

  const loadProtocol = useCallback(async () => {
    const response = await fetch("/api/pilot", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load event room.");
    }

    syncPayloadState(data);
  }, [syncPayloadState]);

  useEffect(() => {
    let isMounted = true;

    async function start() {
      try {
        await loadProtocol();
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load event room.");
        }
      }
    }

    void start();

    return () => {
      isMounted = false;
    };
  }, [loadProtocol]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  async function uploadSubmissionFile(eventId: string, round: number) {
    if (!file) {
      throw new Error("Choose your audio file first.");
    }

    const formData = new FormData();
    formData.append("file", file);
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

    return String(data.publicUrl || "");
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>, eventId: string, round: number) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const audioUrl = await uploadSubmissionFile(eventId, round);
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          artistId,
          eventId,
          title,
          audioUrl,
          durationSeconds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Submission failed.");
      }

      syncPayloadState(data);
      setMessage("Submission uploaded. Stand by for judging.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const artist = payload?.artists.find((entry) => entry.id === artistId);
  const eventRoom = payload?.events.find((event) => event.entries.some((entry) => entry.artistId === artistId)) || null;
  const submission = payload?.submissions.find(
    (entry) => entry.artistId === artistId && entry.eventId === eventRoom?.id && entry.round === eventRoom?.currentRound,
  );
  const assignment = payload?.assignments.find((entry) => entry.judgeArtistId === artistId && entry.status === "assigned");
  const battle = payload?.battles.find((entry) => entry.id === assignment?.battleId);
  const judgingEvent = payload?.events.find((entry) => entry.id === battle?.eventId) || null;
  const matchupSubmissions = useMemo(() => {
    if (!payload || !battle) {
      return [];
    }

    return payload.submissions.filter(
      (entry) =>
        entry.eventId === battle.eventId &&
        entry.round === battle.round &&
        (entry.artistId === battle.artistAId || entry.artistId === battle.artistBId),
    );
  }, [payload, battle]);

  const matchupArtists = useMemo(() => {
    if (!payload || !battle) {
      return [];
    }

    return [battle.artistAId, battle.artistBId]
      .map((id) => {
        const competitor = payload.artists.find((entry) => entry.id === id);
        const submissionEntry = matchupSubmissions.find((entry) => entry.artistId === id);

        if (!competitor || !submissionEntry) {
          return null;
        }

        return {
          artist: competitor,
          submission: submissionEntry,
        };
      })
      .filter(Boolean) as Array<{ artist: Artist; submission: MatchSubmission }>;
  }, [battle, matchupSubmissions, payload]);

  const assignmentExpired = assignment?.dueAt ? new Date(assignment.dueAt).getTime() <= currentTime : false;
  const countdownLabel = assignment?.dueAt ? relativeCountdown(assignment.dueAt) : "Awaiting trigger";
  const playbackUnlocked = matchupArtists.length > 0 && matchupArtists.every(({ submission }) => playedOnce[submission.id]);
  const CARD_PLAY_BUDGET_MS = 6 * 60 * 1000;
  const eventStarted = eventRoom?.queueClosedAt ? new Date(eventRoom.queueClosedAt).getTime() <= currentTime : true;
  const scoreCategories = useMemo(() => payload?.scoreCategories || [], [payload?.scoreCategories]);
  const sliderDecision = useMemo(() => aggregateFromSliders(sliders), [sliders]);
  const winningScoreArtistId = !sliderDecision.isTie && battle
    ? sliderDecision.aPct > sliderDecision.bPct
      ? battle.artistAId
      : battle.artistBId
    : "";

  const scoreLeader = matchupArtists.find(({ artist: contender }) => contender.id === winningScoreArtistId)?.artist.name || "TBD";
const battleHeadline = matchupArtists.map(({ artist }) => artist.name).join(" vs ") || "Battle card";
  async function handleJudgeSubmission() {
    if (!assignment || !battle || !playbackUnlocked || sliderDecision.isTie) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "judge",
          assignmentId: assignment.id,
          sliders,
          events: judgmentEvents,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Judgment could not be submitted.");
      }

      syncPayloadState(data);
      setMessage("Judgment submitted. Stand by for the next wave.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Judgment could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  function updateSlider(key: ScoreCategory["key"], value: number) {
    setSliders((current) => {
      const next = { ...current, [key]: Math.min(100, Math.max(0, Math.round(value))) };
      const agg = aggregateFromSliders(next);
      setJudgmentEvents((events) => [
        ...events,
        {
          id: crypto.randomUUID(),
          battleId: battle?.id,
          assignmentId: assignment?.id,
          tMs: 0,
          type: "slider",
          category: key,
          sliders: next,
          aPct: agg.aPct,
          bPct: agg.bPct,
        },
      ]);
      return next;
    });
  }


  function cardBudgetLeftMs(submissionId: string) {
    const deadline = cardDeadlineAt[submissionId];
    if (!deadline) {
      return CARD_PLAY_BUDGET_MS;
    }
    return Math.max(0, deadline - currentTime);
  }

  function cardBudgetExpired(submissionId: string) {
    return Boolean(cardDeadlineAt[submissionId]) && cardBudgetLeftMs(submissionId) <= 0;
  }

  function formatBudget(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function startCardBudget(submissionId: string) {
    setPlayedOnce((current) => ({ ...current, [submissionId]: true }));
    setCardDeadlineAt((current) => current[submissionId] ? current : { ...current, [submissionId]: Date.now() + CARD_PLAY_BUDGET_MS });
  }

  function playSubmission(submissionId: string) {
    Object.entries(audioRefs.current).forEach(([id, node]) => {
      if (!node) {
        return;
      }

      if (id !== submissionId) {
        node.pause();
      }
    });

    if (cardBudgetExpired(submissionId)) {
      return;
    }

    const nextAudio = audioRefs.current[submissionId];
    if (!nextAudio) {
      return;
    }

    startCardBudget(submissionId);
    void nextAudio.play();
    setPlayingSubmissionId(submissionId);
  }

  function pauseSubmission(submissionId: string) {
    const audioNode = audioRefs.current[submissionId];
    if (!audioNode) {
      return;
    }

    audioNode.pause();
    setPlayingSubmissionId((current) => (current === submissionId ? null : current));
  }

  function restartSubmission(submissionId: string) {
    const audioNode = audioRefs.current[submissionId];
    if (!audioNode) {
      return;
    }

    if (cardBudgetExpired(submissionId)) {
      return;
    }
    audioNode.currentTime = 0;
    startCardBudget(submissionId);
    void audioNode.play();
    setPlayingSubmissionId(submissionId);
  }

  if (!payload || !artist) {
    return (
      <main className="artist-room-page">
        <section className="artist-room-shell">
          <p>{message || "Loading event room..."}</p>
          <Link href="/artist">Return to artist access</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="artist-room-page">
      <section className="artist-room-shell">
        <header className="artist-room-header">
          <div>
            <span className="artist-entry-kicker">Private Event Room</span>
            <h1>{eventRoom?.title || "No active event"}</h1>
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

        {eventRoom ? (
          <>
            <section className="artist-room-grid">
              <article className="artist-room-panel">
                <h2>Challenge</h2>
                <strong>{eventRoom.challengeTitle}</strong>
                <p>{eventRoom.challengeDescription}</p>
                <a className="artist-room-link secondary" href={eventRoom.challengeAudioUrl} target="_blank" rel="noreferrer">
                  Download / open beat
                </a>
              </article>

              <article className="artist-room-panel">
                <h2>Clock</h2>
                <span>Event start (ET)</span>
                <strong>{easternTime(eventRoom.queueClosedAt)}</strong>
                <em>Challenge starts {relativeCountdown(eventRoom.queueClosedAt)}</em>
                <span>Submission window</span>
                <strong>{eventStarted ? relativeCountdown(eventRoom.submissionDeadline) : "Waiting for start"}</strong>
                <em>Judging window {relativeCountdown(eventRoom.judgingDeadline)}</em>
              </article>
            </section>

            <form className="artist-room-panel artist-room-panel-wide" onSubmit={(event) => handleSubmission(event, eventRoom.id, eventRoom.currentRound)}>
              <h2>Submit your round</h2>
              <label>
                Track title
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                Upload submission
                <input
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  type="file"
                />
              </label>
              <label>
                Length in seconds
                <input
                  max="180"
                  min="1"
                  type="number"
                  value={durationSeconds}
                  onChange={(event) => setDurationSeconds(Number(event.target.value))}
                />
              </label>
              <button disabled={isBusy || !eventStarted || eventRoom.phase === "judging" || eventRoom.phase === "complete"} type="submit">
                Upload submission
              </button>
              <p>
                {submission
                  ? `Current submission: ${submission.title}`
                  : eventStarted
                    ? "No file submitted for this round yet."
                    : "Submission stays locked until the Eastern start time is reached."}
              </p>
            </form>

            <section className="artist-room-grid">
              <article className="artist-room-panel">
                <h2>Standby</h2>
                <p>
                  {assignment
                    ? "Your judging card is active. Review both tracks and make your decision before the wave expires."
                    : "Once your file is in, remain on standby. Your judging duty is required for your submission to remain valid."}
                </p>
                <strong>{assignment ? `Assignment due in ${countdownLabel}` : "No active judging card"}</strong>
              </article>

              <article className="artist-room-panel">
                <h2>Current matchup</h2>
                {assignment && battle && matchupArtists.length === 2 ? (
                  <>
                    <strong>
                      {judgingEvent?.title || "Judging wave"} round {battle.round}
                    </strong>
                    <p>
                      The clock started when this wave was distributed. Listen to both tracks all the way through once,
                      then score both contenders across the weighted judging attributes.
                    </p>
                    <div className="judge-battle-header">
                      <div>
                        <span>Battle card</span>
                        <strong>{battleHeadline}</strong>
                      </div>
                      <div className="judge-battle-meta">
                        <span>Round {battle.round}</span>
                        <span>{judgingEvent?.challengeTitle || "Challenge active"}</span>
                        <span>{playbackUnlocked ? `Leader: ${scoreLeader}` : "Press play on both cards"}</span>
                      </div>
                    </div>
                    <div className="judge-playback-grid">
                      {matchupArtists.map(({ artist: competitor, submission: matchupSubmission }, index) => {
                        const heardOnce = !!playedOnce[matchupSubmission.id];
                        const isSelected = winningScoreArtistId === competitor.id;
                        const isPlaying = playingSubmissionId === matchupSubmission.id;

                        return (
                          <article className={isSelected ? "judge-playback-card is-leading" : "judge-playback-card"} key={matchupSubmission.id}>
                            <div className="judge-card-topline">
                              <span>Contender {index + 1}</span>
                              <em>{isSelected ? "Current leader" : "Scorecard"}</em>
                            </div>
                            <strong>{competitor.name}</strong>
                            <em>{matchupSubmission.title}</em>
                            <div className="judge-card-meta">
                              <span>Submission</span>
                              <span>{matchupSubmission.durationSeconds}s</span>
                            </div>
                            <small>
                              {cardBudgetExpired(matchupSubmission.id)
                                ? "Card listen window closed."
                                : heardOnce
                                  ? `Listen window ${formatBudget(cardBudgetLeftMs(matchupSubmission.id))}`
                                  : "Press play to open this card. 6:00 starts on first play."}
                            </small>
                            <audio
                              controls={!cardBudgetExpired(matchupSubmission.id) && !assignmentExpired}
                              onEnded={() => {
                                setPlayingSubmissionId((current) =>
                                  current === matchupSubmission.id ? null : current,
                                );
                              }}
                              onPause={() => {
                                setPlayingSubmissionId((current) =>
                                  current === matchupSubmission.id ? null : current,
                                );
                              }}
                              onPlay={() => {
                                if (cardBudgetExpired(matchupSubmission.id)) {
                                  audioRefs.current[matchupSubmission.id]?.pause();
                                  return;
                                }
                                startCardBudget(matchupSubmission.id);
                                setPlayingSubmissionId(matchupSubmission.id);
                              }}
                              onTimeUpdate={(event) => {
                                if (cardBudgetExpired(matchupSubmission.id)) {
                                  event.currentTarget.pause();
                                }
                              }}
                              preload="metadata"
                              ref={(node) => {
                                audioRefs.current[matchupSubmission.id] = node;
                              }}
                              src={matchupSubmission.audioUrl}
                            />
                            <div className="judge-audio-gate">
                              <button
                                disabled={cardBudgetExpired(matchupSubmission.id) || assignmentExpired || isBusy}
                                onClick={() => playSubmission(matchupSubmission.id)}
                                type="button"
                              >
                                {cardBudgetExpired(matchupSubmission.id) ? "Window closed" : isPlaying ? "Playing..." : "Play"}
                              </button>
                              <button
                                disabled={cardBudgetExpired(matchupSubmission.id) || assignmentExpired}
                                onClick={() => pauseSubmission(matchupSubmission.id)}
                                type="button"
                              >
                                Pause
                              </button>
                              <button
                                disabled={cardBudgetExpired(matchupSubmission.id) || assignmentExpired}
                                onClick={() => restartSubmission(matchupSubmission.id)}
                                type="button"
                              >
                                Restart
                              </button>
                            </div>

                          </article>
                        );
                      })}
                    </div>

                    <div className="judge-scorecard judge-comparative">
                      <div>
                        <span>Battle meter</span>
                        <strong>
                          {matchupArtists[0]?.artist.name} {sliderDecision.aPct}% — {sliderDecision.bPct}% {matchupArtists[1]?.artist.name}
                        </strong>
                      </div>
                      {scoreCategories.map((category) => (
                        <FateMeter
                          disabled={!playbackUnlocked || assignmentExpired || isBusy}
                          key={category.key}
                          label={category.label}
                          nameA={matchupArtists[0]?.artist.name || "A"}
                          nameB={matchupArtists[1]?.artist.name || "B"}
                          onChange={(value) => updateSlider(category.key, value)}
                          value={sliders[category.key] ?? 50}
                          weight={category.weight}
                        />
                      ))}
                      {sliderDecision.isTie ? <p>Center is even. Move at least one meter off 0 / 0 before lock.</p> : null}
                    </div>
                    <div className="judge-status-strip">
                      <span>
                        {playbackUnlocked
                          ? `Scorecard unlocked. Leader: ${scoreLeader}`
                          : "Press play once on each card"}
                      </span>
                      <strong>
                        {assignmentExpired
                          ? "Judging window expired"
                          : `Duty ${countdownLabel} · A ${matchupArtists[0] ? formatBudget(cardBudgetLeftMs(matchupArtists[0].submission.id)) : "6:00"} · B ${matchupArtists[1] ? formatBudget(cardBudgetLeftMs(matchupArtists[1].submission.id)) : "6:00"}`}
                      </strong>
                    </div>
                    <button
                      disabled={!playbackUnlocked || sliderDecision.isTie || assignmentExpired || isBusy}
                      onClick={() => void handleJudgeSubmission()}
                      type="button"
                    >
                      Lock fate
                    </button>
                  </>
                ) : (
                  <>
                    <strong>Waiting for the next wave</strong>
                    <p>When your card is issued, it will appear here with the live countdown already running.</p>
                  </>
                )}
              </article>
            </section>
          </>
        ) : (
          <section className="artist-room-panel artist-room-panel-wide">
            <h2>No active event</h2>
            <p>Join one of the open event queues from your dashboard to unlock this room.</p>
          </section>
        )}
      </section>
    </main>
  );
}
