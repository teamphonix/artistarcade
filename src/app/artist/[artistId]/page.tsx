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
  notificationPreferences?: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
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
  notifications: Notification[];
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
  const [withdrawAmount, setWithdrawAmount] = useState(100);

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
  const notificationPreferences = artist?.notificationPreferences || {
    inApp: true,
    email: false,
    sms: false,
    push: false,
  };
  const artistNotifications =
    payload?.notifications.filter((notification) => notification.audience === "artist" && notification.artistId === artistId) ||
    [];
  const priorityNotification =
    artistNotifications.find((notification) => notification.level === "action") || artistNotifications[0] || null;

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
            <span className="artist-entry-kicker">Artist profile</span>
            <h1>{artist.name}</h1>
            <p>{artist.email}</p>
          </div>
          <div className="artist-dashboard-links">
            <Link className="artist-room-link" href={`/artist/${artist.id}/events`}>
              Open arena
            </Link>
            <Link className="artist-room-link" href={`/artist/${artist.id}/event`}>
              Open event room
            </Link>
            <Link className="artist-room-link secondary" href={`/artist/${artist.id}/results`}>
              View results
            </Link>
          </div>
        </header>

        {message ? <p className="artist-entry-message">{message}</p> : null}

        <section className="artist-dashboard-panel artist-dashboard-panel-wide artist-next-step">
          <div>
            <span>Next protocol step</span>
            <h2>{priorityNotification?.title || "Enter the arena"}</h2>
            <p>
              {priorityNotification?.body ||
                "Add funds, choose an open event, submit when the window opens, judge when assigned, and check results after the bracket resolves."}
            </p>
          </div>
          <Link className="artist-room-link" href={priorityNotification?.actionHref || `/artist/${artist.id}/events`}>
            Continue
          </Link>
        </section>

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
            <h2>Wallet</h2>
            <label>
              Add funds in cents
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

          <form
            className="artist-dashboard-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void postProtocol("withdraw", {
                artistId: artist.id,
                amountCents: withdrawAmount,
              });
            }}
          >
            <h2>Withdraw</h2>
            <p>Beta ledger withdrawal. This reduces available wallet balance in the protocol state.</p>
            <label>
              Withdraw amount in cents
              <input
                min="100"
                step="100"
                type="number"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(Number(event.target.value))}
              />
            </label>
            <button disabled={isBusy || artist.walletCents < withdrawAmount} type="submit">
              Withdraw funds
            </button>
          </form>

          <article className="artist-dashboard-panel">
            <h2>Arena</h2>
            <p>
              View available beta events, join one queue, and stand by until the system opens submissions. Create event
              is visible for the product path, but locked during beta.
            </p>
            <div className="artist-dashboard-event">
              <span>{currentEntry ? `${currentEvent?.title || "Current event"} is locked to your profile` : `${availableEvents.length} events open for entry`}</span>
              <span>{currentEntry ? "Open the event room for the next protocol step." : "Choose your next battle from the portal."}</span>
            </div>
            <div className="artist-dashboard-links">
              <Link className="artist-room-link" href={currentEntry ? `/artist/${artist.id}/event` : `/artist/${artist.id}/events`}>
                {currentEntry ? "Open event room" : "Open arena"}
              </Link>
              <button className="artist-room-link secondary" disabled type="button">
                Create event - beta locked
              </button>
            </div>
          </article>

          <form
            className="artist-dashboard-panel"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void postProtocol("updateNotificationPreferences", {
                artistId: artist.id,
                email: formData.get("email") === "on",
                sms: formData.get("sms") === "on",
                push: formData.get("push") === "on",
              });
            }}
          >
            <h2>Notifications</h2>
            <p>In-app alerts are always on. External channels are saved here now and can route live when providers connect.</p>
            <div className="notification-preference-list">
              <label>
                <input checked disabled name="inApp" type="checkbox" />
                <span>In-app</span>
                <em>Active</em>
              </label>
              <label>
                <input defaultChecked={notificationPreferences.email} name="email" type="checkbox" />
                <span>Email</span>
                <em>Ready for routing</em>
              </label>
              <label>
                <input defaultChecked={notificationPreferences.sms} name="sms" type="checkbox" />
                <span>SMS</span>
                <em>Provider pending</em>
              </label>
              <label>
                <input defaultChecked={notificationPreferences.push} name="push" type="checkbox" />
                <span>Push</span>
                <em>App install pending</em>
              </label>
            </div>
            <button disabled={isBusy} type="submit">
              Save preferences
            </button>
          </form>
        </section>

        <section className="artist-dashboard-panel artist-dashboard-panel-wide">
          <h2>Notifications</h2>
          <div className="protocol-notification-list">
            {artistNotifications.length > 0 ? (
              artistNotifications.slice(0, 6).map((notification) => (
                <article className={`protocol-notification is-${notification.level}`} key={notification.id}>
                  <div>
                    <span>{shortTime(notification.createdAt)}</span>
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                  </div>
                  {notification.actionHref ? (
                    <Link className="artist-room-link secondary" href={notification.actionHref}>
                      Open
                    </Link>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="artist-empty-state">
                <strong>No notifications yet</strong>
                <span>Your protocol alerts will appear here as the event moves.</span>
              </div>
            )}
          </div>
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
