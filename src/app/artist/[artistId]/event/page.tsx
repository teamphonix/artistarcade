"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type EventSummary = {
  id: string;
  title: string;
  challengeTitle: string;
  challengeDescription: string;
  challengeAudioUrl: string;
  phase: string;
  currentRound: number;
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
};

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

export default function ArtistEventRoomPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId;
  const [payload, setPayload] = useState<ProtocolPayload | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [file, setFile] = useState<File | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [heardFullTrack, setHeardFullTrack] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [playingSubmissionId, setPlayingSubmissionId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const assignmentIdRef = useRef<string | null>(null);

  const syncPayloadState = useCallback((data: ProtocolPayload) => {
    const nextAssignmentId =
      data.assignments.find((entry) => entry.judgeArtistId === artistId && entry.status === "assigned")?.id || null;

    if (nextAssignmentId !== assignmentIdRef.current) {
      assignmentIdRef.current = nextAssignmentId;
      setSelectedWinnerId("");
      setHeardFullTrack({});
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
  const playbackUnlocked = matchupArtists.length > 0 && matchupArtists.every(({ submission }) => heardFullTrack[submission.id]);

  async function handleJudgeSubmission() {
    if (!assignment || !selectedWinnerId || !playbackUnlocked) {
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
          selectedWinnerArtistId: selectedWinnerId,
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

  function playSubmission(submissionId: string) {
    Object.entries(audioRefs.current).forEach(([id, node]) => {
      if (!node) {
        return;
      }

      if (id !== submissionId) {
        node.pause();
      }
    });

    const nextAudio = audioRefs.current[submissionId];
    if (!nextAudio) {
      return;
    }

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

    audioNode.currentTime = 0;
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
          <Link className="artist-room-link" href={`/artist/${artist.id}`}>
            Back to dashboard
          </Link>
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
                <span>Submission window</span>
                <strong>{relativeCountdown(eventRoom.submissionDeadline)}</strong>
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
              <button disabled={isBusy || eventRoom.phase === "judging" || eventRoom.phase === "complete"} type="submit">
                Upload submission
              </button>
              <p>{submission ? `Current submission: ${submission.title}` : "No file submitted for this round yet."}</p>
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
                      The clock started when this wave was distributed. Listen to both tracks all the way through once to unlock
                      your decision.
                    </p>
                    <div className="judge-playback-grid">
                      {matchupArtists.map(({ artist: competitor, submission: matchupSubmission }) => {
                        const heardOnce = !!heardFullTrack[matchupSubmission.id];
                        const isSelected = selectedWinnerId === competitor.id;
                        const isPlaying = playingSubmissionId === matchupSubmission.id;

                        return (
                          <article className="judge-playback-card" key={matchupSubmission.id}>
                            <span>Submission</span>
                            <strong>{competitor.name}</strong>
                            <em>{matchupSubmission.title}</em>
                            <small>
                              {heardOnce
                                ? "Full listen completed. Advanced playback unlocked."
                                : "Complete one full listen before decision unlocks."}
                            </small>
                            <audio
                              controls={playbackUnlocked}
                              onEnded={() => {
                                setHeardFullTrack((current) => ({ ...current, [matchupSubmission.id]: true }));
                                setPlayingSubmissionId((current) =>
                                  current === matchupSubmission.id ? null : current,
                                );
                              }}
                              onPause={() => {
                                setPlayingSubmissionId((current) =>
                                  current === matchupSubmission.id ? null : current,
                                );
                              }}
                              onPlay={() => setPlayingSubmissionId(matchupSubmission.id)}
                              preload="metadata"
                              ref={(node) => {
                                audioRefs.current[matchupSubmission.id] = node;
                              }}
                              src={matchupSubmission.audioUrl}
                            />
                            {!playbackUnlocked ? (
                              <div className="judge-audio-gate">
                                <button onClick={() => playSubmission(matchupSubmission.id)} type="button">
                                  {isPlaying ? "Playing..." : "Play full track"}
                                </button>
                                <button onClick={() => pauseSubmission(matchupSubmission.id)} type="button">
                                  Pause
                                </button>
                                <button onClick={() => restartSubmission(matchupSubmission.id)} type="button">
                                  Restart
                                </button>
                              </div>
                            ) : null}
                            <button
                              className={isSelected ? "judge-select is-selected" : "judge-select"}
                              disabled={!playbackUnlocked || assignmentExpired || isBusy}
                              onClick={() => setSelectedWinnerId(competitor.id)}
                              type="button"
                            >
                              Select {competitor.name}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                    <div className="judge-status-strip">
                      <span>{playbackUnlocked ? "Decision unlocked" : "Both tracks must finish once"}</span>
                      <strong>{assignmentExpired ? "Judging window expired" : `Time left ${countdownLabel}`}</strong>
                    </div>
                    <button
                      disabled={!playbackUnlocked || !selectedWinnerId || assignmentExpired || isBusy}
                      onClick={() => void handleJudgeSubmission()}
                      type="button"
                    >
                      Submit decision
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
