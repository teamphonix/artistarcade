"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Artist = {
  id: string;
  name: string;
  betaRulesAcceptedAt?: string | null;
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

type Assignment = {
  id: string;
  battleId: string;
  judgeArtistId: string;
  status: string;
  assignedAt: string;
  dueAt: string | null;
  completedAt: string | null;
};

type Submission = {
  id: string;
  eventId: string;
  artistId: string;
  round: number;
  title: string;
  audioUrl: string;
  durationSeconds: number;
  submittedAt: string;
};

type Judgment = {
  id: string;
  assignmentId: string;
  battleId: string;
  judgeArtistId: string;
  selectedWinnerArtistId: string;
  createdAt: string;
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
  queueClosedAt: string | null;
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

type AuditEntry = {
  id: string;
  eventId: string | null;
  artistId: string | null;
  action: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type Notification = {
  id: string;
  audience: "artist" | "host";
  artistId: string | null;
  eventId: string | null;
  level: "info" | "action" | "success" | "warning";
  title: string;
  body: string;
  actionHref: string | null;
  createdAt: string;
};

type BetaReadiness = {
  overall: "ready" | "warning" | "blocked";
  ready: number;
  warning: number;
  blocked: number;
  checks: Array<{
    id: string;
    label: string;
    status: "ready" | "warning" | "blocked";
    detail: string;
  }>;
};

type ProtocolPayload = {
  backend: "local" | "supabase";
  artists: Artist[];
  events: EventSummary[];
  submissions: Submission[];
  assignments: Assignment[];
  judgments: Judgment[];
  auditLog: AuditEntry[];
  notifications: Notification[];
  betaReadiness: BetaReadiness;
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

function formatAuditAction(action: string) {
  return action.replaceAll("_", " ");
}

function formatAuditMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata || {}).filter(([, value]) => value !== null && value !== undefined);

  if (entries.length === 0) {
    return "No extra protocol data";
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
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

function statusTone(status: string) {
  if (["complete", "completed", "winner", "ready"].includes(status)) {
    return "is-success";
  }

  if (["judging", "assigned", "action", "warning"].includes(status)) {
    return "is-action";
  }

  if (["expired", "eliminated", "blocked"].includes(status)) {
    return "is-warning";
  }

  return "is-info";
}

function formatEastern(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const zonePart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = zonePart?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function easternInputToIso(value: string) {
  if (!value) {
    return "";
  }

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return "";
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute);

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsetMinutes = getOffsetMinutes(new Date(utcMillis), "America/New_York");
    utcMillis = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000;
  }

  return new Date(utcMillis).toISOString();
}

function isoToEasternInput(value: string | null) {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
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
    eventStartAtInput: "",
  });

  function applyEventDraft(event: EventSummary | null) {
    if (!event) {
      return;
    }

    setEventDraft({
      challengeTitle: event.challengeTitle,
      challengeDescription: event.challengeDescription,
      challengeAudioUrl: event.challengeAudioUrl,
      eventStartAtInput: isoToEasternInput(event.queueClosedAt),
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
  const hostNotifications =
    payload?.notifications.filter((notification) => notification.audience === "host") || [];
  const actionNotifications = hostNotifications.filter((notification) => notification.level === "action").length;
  const readiness = payload?.betaReadiness || null;
  const selectedEventSubmissions =
    payload?.submissions
      .filter((submission) => submission.eventId === selectedEvent?.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) || [];
  const selectedEventAssignments =
    payload?.assignments
      .filter((assignment) => selectedEvent?.battles.some((battle) => battle.id === assignment.battleId))
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt)) || [];
  const openAssignments = selectedEventAssignments.filter((assignment) => assignment.status === "assigned");
  const selectedJudgments =
    payload?.judgments.filter((judgment) =>
      selectedEvent?.battles.some((battle) => battle.id === judgment.battleId),
    ) || [];
  const artistsNeedingFunds = payload?.artists.filter((artist) => artist.walletCents < 100).length || 0;
  const activeArtistsMissingRules =
    payload?.artists.filter((artist) => artist.status !== "registered" && !artist.betaRulesAcceptedAt).length || 0;

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

  async function runProtocolTick() {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/protocol/tick", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Protocol tick failed.");
      }

      const nextResponse = await fetch("/api/pilot", { cache: "no-store" });
      const nextPayload = await nextResponse.json();

      if (!nextResponse.ok) {
        throw new Error(nextPayload.error || "Protocol refresh failed.");
      }

      syncPayload(nextPayload);
      setMessage(`Protocol tick completed at ${shortTime(data.tickedAt)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Protocol tick failed.");
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
          eventStartAt: easternInputToIso(eventDraft.eventStartAtInput),
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
        <article>
          <span>Open cards</span>
          <strong>{openAssignments.length}</strong>
        </article>
      </section>

      <section className="pilot-panel pilot-notification-panel">
        <div>
          <span className="pilot-kicker">Moderation Center</span>
          <h2>Protocol notifications</h2>
          <p>
            Action cards show where the pilot needs attention. These are in-app now and can route to text/email later.
          </p>
        </div>
        <strong>{actionNotifications} actions</strong>
      </section>

      {readiness ? (
        <section className={`pilot-panel beta-readiness-panel is-${readiness.overall}`}>
          <header>
            <div>
              <span className="pilot-kicker">Beta Launch Readiness</span>
              <h2>{readiness.overall === "ready" ? "Ready to invite" : readiness.overall === "warning" ? "Almost there" : "Not ready yet"}</h2>
              <p>
                Launch gates for the official pilot. Green can ship, yellow needs a decision, red blocks real artists
                and real money.
              </p>
            </div>
            <aside>
              <strong>{readiness.ready}</strong>
              <span>ready</span>
              <strong>{readiness.warning}</strong>
              <span>watch</span>
              <strong>{readiness.blocked}</strong>
              <span>blocked</span>
            </aside>
          </header>
          <div className="beta-readiness-grid">
            {readiness.checks.map((check) => (
              <article className={`beta-readiness-card is-${check.status}`} key={check.id}>
                <span>{check.status}</span>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
          <label>
            Event start (ET)
            <input
              type="datetime-local"
              value={eventDraft.eventStartAtInput}
              onChange={(event) => setEventDraft((current) => ({ ...current, eventStartAtInput: event.target.value }))}
            />
          </label>
          <p className="artist-muted">
            Submission deadline is automatically set to 24 hours after the Eastern start time you choose.
          </p>
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
            <span>Start time (ET): {formatEastern(selectedEvent.queueClosedAt)}</span>
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
          <button disabled={isBusy} onClick={() => void runProtocolTick()} type="button">
            Run protocol tick
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
          <h2>Beta watchlist</h2>
          <div className="protocol-summary">
            <span>Open assignments: {openAssignments.length}</span>
            <span>Event submissions: {selectedEventSubmissions.length}</span>
            <span>Judgments recorded: {selectedJudgments.length}</span>
            <span>Artists below $1: {artistsNeedingFunds}</span>
            <span>Entrants missing rules: {activeArtistsMissingRules}</span>
          </div>
          <p>
            Quick scan for the pilot. If anything stalls, the ledgers and audit trail below show where the protocol
            stopped.
          </p>
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
          <h2>Host notifications</h2>
          <div className="protocol-notification-list">
            {hostNotifications.length > 0 ? (
              hostNotifications.slice(0, 8).map((notification) => (
                <article className={`protocol-notification is-${notification.level}`} key={notification.id}>
                  <div>
                    <span>{shortTime(notification.createdAt)}</span>
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                  </div>
                  <em>{notification.eventId ? payload.events.find((event) => event.id === notification.eventId)?.title : "Protocol"}</em>
                </article>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No host actions</strong>
                <span>The pilot has no pending moderation cards right now.</span>
              </div>
            )}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Round battles</h2>
          <div className="pilot-table">
            {selectedEvent.battles.length > 0 ? (
              selectedEvent.battles.map((battle) => (
                <div className="pilot-row" key={battle.id}>
                  <strong>
                    R{battle.round}.{battle.slot}
                  </strong>
                  <span>
                    {artistMap.get(battle.artistAId)?.name} vs {artistMap.get(battle.artistBId)?.name}
                  </span>
                  <span className={`operator-pill ${statusTone(battle.status)}`}>{battle.status}</span>
                  <span>{battle.winnerArtistId ? artistMap.get(battle.winnerArtistId)?.name : "TBD"}</span>
                </div>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No battles generated yet</strong>
                <span>Battles appear after the 16-artist queue locks.</span>
              </div>
            )}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Submission ledger</h2>
          <div className="pilot-table">
            {selectedEventSubmissions.length > 0 ? (
              selectedEventSubmissions.map((submission) => (
                <div className="pilot-row pilot-row-wide" key={submission.id}>
                  <strong>{artistMap.get(submission.artistId)?.name || "Artist"}</strong>
                  <span>Round {submission.round}</span>
                  <span>{submission.title}</span>
                  <span>{submission.durationSeconds}s</span>
                  <span>{shortTime(submission.submittedAt)}</span>
                </div>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No submissions yet</strong>
                <span>When artists upload tracks, this ledger becomes the operator view of the round.</span>
              </div>
            )}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Judging assignment ledger</h2>
          <div className="pilot-table">
            {selectedEventAssignments.length > 0 ? (
              selectedEventAssignments.map((assignment) => {
                const assignmentBattle = selectedEvent.battles.find((battle) => battle.id === assignment.battleId);
                const judgment = payload.judgments.find((entry) => entry.assignmentId === assignment.id) || null;

                return (
                  <div className="pilot-row pilot-row-wide" key={assignment.id}>
                    <strong>{artistMap.get(assignment.judgeArtistId)?.name || "Judge"}</strong>
                    <span>
                      {assignmentBattle ? `R${assignmentBattle.round}.${assignmentBattle.slot}` : "Battle pending"}
                    </span>
                    <span className={`operator-pill ${statusTone(assignment.status)}`}>{assignment.status}</span>
                    <span>{assignment.dueAt ? `Due ${relativeCountdown(assignment.dueAt)}` : "No due time"}</span>
                    <span>
                      {judgment
                        ? `Picked ${artistMap.get(judgment.selectedWinnerArtistId)?.name || "winner"}`
                        : "No judgment yet"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="artist-empty-state">
                <strong>No judging cards yet</strong>
                <span>Cards appear after active artists submit and the judging wave is distributed.</span>
              </div>
            )}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Artist roster</h2>
          <div className="pilot-table">
            {payload.artists.slice(0, 24).map((artist) => (
              <div className="pilot-row pilot-row-roster" key={artist.id}>
                <strong>{artist.name}</strong>
                <span className={`operator-pill ${statusTone(artist.status)}`}>{artist.status}</span>
                <span>Wallet {money(artist.walletCents)}</span>
                <span>Rewards {money(artist.rewardCents)}</span>
                <span>{artist.betaRulesAcceptedAt ? "Rules accepted" : "Rules pending"}</span>
                <Link className="artist-room-link secondary" href={`/artist/${artist.id}`}>
                  View
                </Link>
              </div>
            ))}
          </div>
        </article>

        <article className="pilot-panel pilot-panel-wide">
          <h2>Protocol audit trail</h2>
          <p>
            The latest automated decisions, artist actions, wallet moves, queue locks, judging waves, and round
            transitions written by the protocol state machine.
          </p>
          <div className="protocol-audit-list">
            {(payload.auditLog || []).length > 0 ? (
              payload.auditLog.slice(0, 24).map((entry) => (
                <div className="protocol-audit-row" key={entry.id}>
                  <div>
                    <span>{shortTime(entry.createdAt)}</span>
                    <strong>{formatAuditAction(entry.action)}</strong>
                    <p>{entry.note}</p>
                  </div>
                  <em>{formatAuditMetadata(entry.metadata)}</em>
                </div>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No audit events yet</strong>
                <span>Run a queue, wallet, submission, or judging action and the protocol will write here.</span>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
