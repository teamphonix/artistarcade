import { NextResponse } from "next/server";
import { AccessError, artistState, authorizeAction, type Principal } from "@/app/lib/access";
import { checkOrigin, requirePrincipal } from "@/app/lib/requestAuth";
import { StateConflictError } from "@/app/lib/databaseState";
import { loadState, persistState } from "@/app/lib/protocolPersistence";
import { autoAdvanceProtocol, lockEventQueue } from "@/app/lib/protocolEngine";
import { readWorkerHealth, workerIsHealthy, type WorkerHealth } from "@/app/lib/protocolWorker";
import { advancePilot, pilotClock } from "@/app/lib/tournament";
import { recordSliderJudgment } from "@/app/lib/recordJudgment";
import {
  ARTISTS_PER_EVENT,
  BETA_RULES_VERSION,
  SCORE_CATEGORIES,
  SUBMISSION_LIMIT_SECONDS,
  SUBMISSION_WINDOW_HOURS,
  eventStandings,
  getEventEntries,
  makeId,
  scoreBattle,
  type ProtocolEntry,
  type ProtocolState,
} from "@/app/lib/pilotStore";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { isValidEmail } from "@/app/lib/protocol";

type ProtocolAction =
  | "upsertArtist"
  | "updateNotificationPreferences"
  | "updateEvent"
  | "deposit"
  | "withdraw"
  | "joinEvent"
  | "closeQueue"
  | "submit"
  | "generateJudgeAssignments"
  | "judge"
  | "finalizeRound"
  | "reset";

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next.toISOString();
}

function defaultNotificationPreferences() {
  return {
    inApp: true,
    email: false,
    sms: false,
    push: false,
  };
}

function ensureAuditLog(state: ProtocolState) {
  if (!Array.isArray(state.auditLog)) {
    state.auditLog = [];
  }
}

function logProtocolEvent(
  state: ProtocolState,
  action: string,
  note: string,
  options: {
    eventId?: string | null;
    artistId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
) {
  ensureAuditLog(state);
  state.auditLog.push({
    id: makeId(),
    eventId: options.eventId || null,
    artistId: options.artistId || null,
    action,
    note,
    metadata: options.metadata || {},
    createdAt: new Date().toISOString(),
  });
}

function buildNotifications(state: ProtocolState) {
  const now = new Date().toISOString();
  const notifications: Array<{
    id: string;
    audience: "artist" | "host";
    artistId: string | null;
    eventId: string | null;
    level: "info" | "action" | "success" | "warning";
    title: string;
    body: string;
    actionHref: string | null;
    createdAt: string;
  }> = [];

  state.events.forEach((event) => {
    const entries = state.entries.filter((entry) => entry.eventId === event.id);
    const eventSubmissions = state.submissions.filter(
      (submission) => submission.eventId === event.id && submission.round === event.currentRound,
    );
    const roundBattles = state.battles.filter((battle) => battle.eventId === event.id && battle.round === event.currentRound);
    const activeRoundArtistIds = new Set(roundBattles.flatMap((battle) => [battle.artistAId, battle.artistBId]));
    const missingSubmissions = [...activeRoundArtistIds].filter(
      (artistId) => !eventSubmissions.some((submission) => submission.artistId === artistId),
    );
    const eventAssignments = state.assignments.filter((assignment) =>
      roundBattles.some((battle) => battle.id === assignment.battleId),
    );
    const openAssignments = eventAssignments.filter((assignment) => assignment.status === "assigned");

    if (event.phase === "queue" && entries.length === ARTISTS_PER_EVENT) {
      notifications.push({
        id: `host-${event.id}-queue-full`,
        audience: "host",
        artistId: null,
        eventId: event.id,
        level: "action",
        title: `${event.title} is ready to lock`,
        body: "The queue has 16 paid entries. The protocol can lock the event and open submissions.",
        actionHref: "/host",
        createdAt: event.queueClosedAt || now,
      });
    }

    if (event.phase === "submission" && missingSubmissions.length > 0) {
      notifications.push({
        id: `host-${event.id}-submissions-missing`,
        audience: "host",
        artistId: null,
        eventId: event.id,
        level: "warning",
        title: `${event.title} needs ${missingSubmissions.length} submissions`,
        body: "The submission window is open. Artists who have not submitted still need to act before judging can open.",
        actionHref: "/host",
        createdAt: event.submissionDeadline || now,
      });
    }

    if (event.phase === "judging" && openAssignments.length > 0) {
      notifications.push({
        id: `host-${event.id}-judging-live`,
        audience: "host",
        artistId: null,
        eventId: event.id,
        level: "action",
        title: `${event.title} judging is live`,
        body: `${openAssignments.length} judging cards are active for round ${event.currentRound}.`,
        actionHref: "/host",
        createdAt: event.judgingDeadline || now,
      });
    }

    if (event.phase === "complete" && event.winnerArtistId) {
      notifications.push({
        id: `host-${event.id}-complete`,
        audience: "host",
        artistId: null,
        eventId: event.id,
        level: "success",
        title: `${event.title} completed`,
        body: "Winner finalized, prize ledger written, and company revenue recorded.",
        actionHref: "/host",
        createdAt: now,
      });
    }

    entries.forEach((entry) => {
      const artist = state.artists.find((savedArtist) => savedArtist.id === entry.artistId);
      if (!artist) {
        return;
      }

      const artistSubmission = eventSubmissions.find((submission) => submission.artistId === artist.id);
      const artistAssignment = state.assignments.find(
        (assignment) => assignment.judgeArtistId === artist.id && assignment.status === "assigned",
      );

      if (event.phase === "queue") {
        notifications.push({
          id: `artist-${artist.id}-${event.id}-queued`,
          audience: "artist",
          artistId: artist.id,
          eventId: event.id,
          level: "info",
          title: "Entry confirmed",
          body: `${event.title} has your $1 entry. The queue is ${entries.length}/16. Your event room will show the next live step when the protocol opens it.`,
          actionHref: `/artist/${artist.id}/event`,
          createdAt: entry.joinedAt,
        });
      }

      if (event.phase === "submission" && activeRoundArtistIds.has(artist.id) && !artistSubmission) {
        notifications.push({
          id: `artist-${artist.id}-${event.id}-submit-round-${event.currentRound}`,
          audience: "artist",
          artistId: artist.id,
          eventId: event.id,
          level: "action",
          title: "Submission window open",
          body: `Round ${event.currentRound} is live for ${event.title}. Upload your track before the deadline.`,
          actionHref: `/artist/${artist.id}/event`,
          createdAt: event.queueClosedAt || now,
        });
      }

      if (event.phase === "submission" && artistSubmission) {
        notifications.push({
          id: `artist-${artist.id}-${event.id}-submitted-round-${event.currentRound}`,
          audience: "artist",
          artistId: artist.id,
          eventId: event.id,
          level: "success",
          title: "Submission received",
          body: `${artistSubmission.title} is locked for round ${event.currentRound}. Stand by for judging.`,
          actionHref: `/artist/${artist.id}/event`,
          createdAt: artistSubmission.submittedAt,
        });
      }

      if (artistAssignment) {
        notifications.push({
          id: `artist-${artist.id}-assignment-${artistAssignment.id}`,
          audience: "artist",
          artistId: artist.id,
          eventId: event.id,
          level: "action",
          title: "You have been assigned as a FateKeeper",
          body: "Their fate is in your hands. Listen, score both artists, and lock your judgment before the 15-minute deadline.",
          actionHref: `/artist/${artist.id}/event`,
          createdAt: artistAssignment.openedAt || artistAssignment.assignedAt,
        });
      }

      if (event.phase === "complete" && event.winnerArtistId === artist.id) {
        notifications.push({
          id: `artist-${artist.id}-${event.id}-winner`,
          audience: "artist",
          artistId: artist.id,
          eventId: event.id,
          level: "success",
          title: "Winner finalized",
          body: `You won ${event.title}. Your prize was added to your wallet ledger.`,
          actionHref: `/artist/${artist.id}/results`,
          createdAt: now,
        });
      }
    });
  });

  state.artists.forEach((artist) => {
    if (artist.walletCents < 100 && !state.entries.some((entry) => entry.artistId === artist.id)) {
      notifications.push({
        id: `artist-${artist.id}-wallet-low`,
        audience: "artist",
        artistId: artist.id,
        eventId: null,
        level: "action",
        title: "Add funds to enter",
        body: "A $1 wallet balance is required before joining a beta event.",
        actionHref: `/artist/${artist.id}`,
        createdAt: artist.createdAt,
      });
    }
  });

  return notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildBetaReadiness(state: ProtocolState, workerHealth: WorkerHealth | null = null) {
  const usesSupabase = Boolean(getSupabaseAdmin());
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const storageConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SUBMISSIONS_BUCKET);
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const hasEvents = state.events.length >= 4;
  const hasScoring = SCORE_CATEGORIES.reduce((sum, category) => sum + category.weight, 0) === 100;
  const hasAuditTrail = Array.isArray(state.auditLog);
  const hasNotifications = true;
  const resetIsPublic = process.env.NODE_ENV !== "production";
  const completedDryRun = state.events.some(
    (event) =>
      event.phase === "complete" &&
      event.winnerArtistId &&
      state.walletLedger.some((entry) => entry.eventId === event.id && entry.type === "prize"),
  );

  const checks = [
    {
      id: "database",
      label: "Production database",
      status: usesSupabase ? "ready" : "blocked",
      detail: usesSupabase ? "Supabase service role is connected." : "Still running on local file state. Connect Supabase before real beta.",
    },
    {
      id: "payments",
      label: "Payment rails",
      status: stripeConfigured ? "ready" : "blocked",
      detail: stripeConfigured ? "Stripe secret and webhook are configured." : "Stripe keys are missing. Wallet deposits are still simulated.",
    },
    {
      id: "storage",
      label: "Submission storage",
      status: storageConfigured ? "ready" : "blocked",
      detail: storageConfigured ? "Supabase upload storage is configured." : "Submission uploads need production storage before real artists.",
    },
    {
      id: "events",
      label: "Pilot events",
      status: hasEvents ? "ready" : "blocked",
      detail: hasEvents ? `${state.events.length} pilot events are available.` : "Seed the beta events before launch.",
    },
    {
      id: "scoring",
      label: "Weighted judging",
      status: hasScoring ? "ready" : "blocked",
      detail: hasScoring ? "Five-category judging weights total 100%." : "Judging category weights must total 100%.",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: hasNotifications ? "warning" : "blocked",
      detail: hasNotifications
        ? "In-app alerts and saved preferences are live. Email/SMS/push routing still needs providers."
        : "Protocol alerts are not available.",
    },
    {
      id: "automation",
      label: "Autonomous tick",
      status: cronConfigured && workerIsHealthy(workerHealth) ? "ready" : "warning",
      detail: !cronConfigured ? "Worker secret is missing." : workerIsHealthy(workerHealth)
        ? `Background worker last succeeded at ${workerHealth!.last_success_at}.`
        : "Background worker has no recent successful run. Verify the deployed schedule and worker logs.",
    },
    {
      id: "audit",
      label: "Audit trail",
      status: hasAuditTrail ? "ready" : "blocked",
      detail: hasAuditTrail ? "Protocol actions write to an audit trail." : "Audit trail is unavailable.",
    },
    {
      id: "rules",
      label: "Beta rules and consent",
      status: "ready",
      detail: `Paid event entry requires acceptance of beta rules version ${BETA_RULES_VERSION}.`,
    },
    {
      id: "reset",
      label: "Reset protection",
      status: resetIsPublic ? "warning" : "ready",
      detail: resetIsPublic ? "Reset exists for local/demo use. Protect or hide it in production." : "Production mode removes the local reset risk.",
    },
    {
      id: "dry-run",
      label: "End-to-end dry run",
      status: completedDryRun ? "ready" : "warning",
      detail: completedDryRun ? "At least one event completed with a prize ledger." : "Run one complete 16-artist production-style test before invites.",
    },
  ] as const;
  const blocked = checks.filter((check) => check.status === "blocked").length;
  const warning = checks.filter((check) => check.status === "warning").length;

  return {
    overall: blocked > 0 ? "blocked" : warning > 0 ? "warning" : "ready",
    blocked,
    warning,
    ready: checks.filter((check) => check.status === "ready").length,
    checks,
  };
}

function summarize(state: ProtocolState, workerHealth: WorkerHealth | null = null) {
  const events = state.events.map((event) => {
    const entries = getEventEntries(state, event.id);
    const battles = state.battles.filter((battle) => battle.eventId === event.id);
    const assignments = state.assignments.filter((assignment) =>
      battles.some((battle) => battle.id === assignment.battleId),
    );

    return {
      ...event,
      queuedCount: entries.length,
      openSlots: ARTISTS_PER_EVENT - entries.length,
      grossPotCents: entries.reduce((sum, entry) => sum + entry.paidCents, 0),
      projectedCompanyCents: Math.max(
        0,
        entries.reduce((sum, entry) => sum + entry.paidCents, 0) - event.desiredPrizeCents,
      ),
      entries,
      standings: eventStandings(state, event.id),
      battles,
      assignmentsTotal: assignments.length,
      assignmentsCompleted: assignments.filter((assignment) => assignment.status === "completed").length,
    };
  });

  const scoredBattles = state.battles.map((battle) => scoreBattle(state, battle.id)).filter(Boolean);

  return {
    tournament: pilotClock(state),
    settings: state.settings,
    artists: state.artists.map((artist) => ({
      ...artist,
      notificationPreferences: artist.notificationPreferences || defaultNotificationPreferences(),
      betaRulesAcceptedAt: artist.betaRulesAcceptedAt || null,
      betaRulesVersion: artist.betaRulesVersion || null,
    })),
    events,
    submissions: state.submissions,
    battles: state.battles,
    assignments: state.assignments,
    judgments: state.judgments,
    judgmentEvents: state.judgmentEvents || [],
    walletLedger: state.walletLedger,
    notifications: buildNotifications(state),
    betaReadiness: buildBetaReadiness(state, workerHealth),
    workerHealth,
    auditLog: [...(state.auditLog || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    scoredBattles,
    scoreCategories: SCORE_CATEGORIES,
    totals: {
      artists: state.artists.length,
      events: state.events.length,
      eventCapacity: state.events.length * ARTISTS_PER_EVENT,
      entries: state.entries.length,
      submissions: state.submissions.length,
      totalBattlesFullBracket: state.events.length * (ARTISTS_PER_EVENT - 1),
      activeBattles: state.battles.filter((battle) => battle.status !== "complete").length,
      completedBattles: state.battles.filter((battle) => battle.status === "complete").length,
      assignments: state.assignments.length,
      completedAssignments: state.assignments.filter((assignment) => assignment.status === "completed").length,
      companyRevenueCents: state.events.reduce((sum, event) => sum + event.companyRevenueCents, 0),
    },
    backend: getSupabaseAdmin() ? "supabase" : "local",
  };
}

function visiblePayload(state: ProtocolState, principal: Principal, workerHealth: WorkerHealth | null = null) {
  if (principal.host) return summarize(state, workerHealth);
  const payload = summarize(artistState(state, principal.email));
  const own = state.artists.find(a => a.email.toLowerCase() === principal.email);
  return { ...payload, tournament: pilotClock(state), notifications: payload.notifications.filter(n => n.audience === "artist" && n.artistId === own?.id), auditLog: [], betaReadiness: null,
    events: payload.events.map(event => ({ ...event,
      queuedCount: state.entries.filter(e => e.eventId === event.id).length,
      openSlots: ARTISTS_PER_EVENT - state.entries.filter(e => e.eventId === event.id).length,
      standings: pilotClock(state)?.revealed ? event.standings : [] })),
    totals: { artists: state.artists.length, events: state.events.length, eventCapacity: state.events.length * ARTISTS_PER_EVENT },
  };
}

async function readPayload(principal: Principal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const state = await loadState();
      if (autoAdvanceProtocol(state)) await persistState(state);
      return visiblePayload(state, principal, principal.host ? await readWorkerHealth() : null);
    } catch (error) {
      if (!(error instanceof StateConflictError) || attempt === 2) throw error;
    }
  }
  throw new StateConflictError();
}

export async function GET(request: Request) {
  try {
    const principal = await requirePrincipal(request);
    return NextResponse.json(await readPayload(principal), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AccessError ? error.message : "Protocol read failed." }, { status: error instanceof AccessError ? error.status : error instanceof StateConflictError ? 409 : 500 });
  }
}

export async function POST(request: Request) {
  let principal: Principal;
  try { checkOrigin(request); principal = await requirePrincipal(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in failed." }, { status: error instanceof AccessError ? error.status : 500 }); }
  const body = await request.json().catch(() => null);
  const action = body?.action as ProtocolAction | undefined;

  if (!action) {
    return NextResponse.json({ error: "Missing protocol action." }, { status: 400 });
  }

  if ((process.env.NODE_ENV === "production" || getSupabaseAdmin()) && ["reset", "deposit", "withdraw"].includes(action)) {
    return NextResponse.json({ error: "Manual resets and balance changes are disabled for persisted USD accounts." }, { status: 403 });
  }

  try {
    const state = await loadState();
    authorizeAction(state, principal, action, body);
    autoAdvanceProtocol(state);
    if (action === "upsertArtist") {
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();

      if (name.length < 2 || name.length > 100 || !isValidEmail(email)) {
        return NextResponse.json({ error: "Name and valid email are required." }, { status: 400 });
      }

      let artist = state.artists.find((entry) => entry.email === email);
      if (!artist) {
        artist = {
          id: makeId(),
          name,
          email,
          walletCents: 0,
          rewardCents: 0,
          status: "registered",
          notificationPreferences: defaultNotificationPreferences(),
          betaRulesAcceptedAt: null,
          betaRulesVersion: null,
          createdAt: new Date().toISOString(),
        };
        state.artists.push(artist);
        logProtocolEvent(state, "artist_registered", `${artist.name} registered.`, {
          artistId: artist.id,
        });
      } else {
        artist.name = name;
      }
    }

    if (action === "updateNotificationPreferences") {
      const artistId = String(body?.artistId || "");
      const artist = state.artists.find((entry) => entry.id === artistId);

      if (!artist) {
        return NextResponse.json({ error: "Artist is required." }, { status: 400 });
      }

      artist.notificationPreferences = {
        inApp: true,
        email: Boolean(body?.email),
        sms: Boolean(body?.sms),
        push: Boolean(body?.push),
      };
      logProtocolEvent(state, "notification_preferences_updated", `${artist.name} updated notification preferences.`, {
        artistId: artist.id,
        metadata: artist.notificationPreferences,
      });
    }

    if (action === "deposit") {
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();
      const amountCents = Math.max(0, Math.round(Number(body?.amountCents || 0)));

      if (name.length < 2 || !isValidEmail(email) || amountCents < 100) {
        return NextResponse.json({ error: "Name, valid email, and deposit amount are required." }, { status: 400 });
      }

      let artist = state.artists.find((entry) => entry.email === email);
      if (!artist) {
        artist = {
          id: makeId(),
          name,
          email,
          walletCents: 0,
          rewardCents: 0,
          status: "registered",
          notificationPreferences: defaultNotificationPreferences(),
          betaRulesAcceptedAt: null,
          betaRulesVersion: null,
          createdAt: new Date().toISOString(),
        };
        state.artists.push(artist);
      }

      artist.name = name;
      artist.walletCents += amountCents;
      state.walletLedger.push({
        id: makeId(),
        artistId: artist.id,
        eventId: null,
        amountCents,
        type: "deposit",
        note: "Wallet deposit",
        createdAt: new Date().toISOString(),
      });
      logProtocolEvent(state, "wallet_deposit", `${artist.name} deposited ${amountCents} cents.`, {
        artistId: artist.id,
        metadata: { amountCents },
      });
    }

    if (action === "withdraw") {
      const artistId = String(body?.artistId || "");
      const amountCents = Math.max(0, Math.round(Number(body?.amountCents || 0)));
      const artist = state.artists.find((entry) => entry.id === artistId);

      if (!artist || amountCents < 100) {
        return NextResponse.json({ error: "Artist and withdrawal amount are required." }, { status: 400 });
      }

      if (artist.walletCents < amountCents) {
        return NextResponse.json({ error: "Wallet balance is too low for that withdrawal." }, { status: 409 });
      }

      artist.walletCents -= amountCents;
      state.walletLedger.push({
        id: makeId(),
        artistId: artist.id,
        eventId: null,
        amountCents: -amountCents,
        type: "withdraw",
        note: "Wallet withdrawal",
        createdAt: new Date().toISOString(),
      });
      logProtocolEvent(state, "wallet_withdraw", `${artist.name} withdrew ${amountCents} cents.`, {
        artistId: artist.id,
        metadata: { amountCents },
      });
    }

    if (action === "updateEvent") {
      const eventId = String(body?.eventId || "");
      const challengeTitle = String(body?.challengeTitle || "").trim();
      const challengeDescription = String(body?.challengeDescription || "").trim();
      const challengeAudioUrl = String(body?.challengeAudioUrl || "").trim();
      const eventStartAt = String(body?.eventStartAt || "").trim();
      const event = state.events.find((entry) => entry.id === eventId);

      if (!event) {
        return NextResponse.json({ error: "Event is required." }, { status: 400 });
      }

      if (challengeTitle.length < 2 || challengeDescription.length < 8 || !challengeAudioUrl || !eventStartAt) {
        return NextResponse.json(
          { error: "Challenge title, description, beat upload, and event start time are required." },
          { status: 400 },
        );
      }

      const startDate = new Date(eventStartAt);
      if (Number.isNaN(startDate.getTime())) {
        return NextResponse.json({ error: "Event start time is invalid." }, { status: 400 });
      }

      event.challengeTitle = challengeTitle;
      event.challengeDescription = challengeDescription;
      event.challengeAudioUrl = challengeAudioUrl;
      event.queueClosedAt = startDate.toISOString();
      event.submissionDeadline = addHours(startDate, SUBMISSION_WINDOW_HOURS);
      logProtocolEvent(state, "event_updated", `${event.title} challenge and start time updated.`, {
        eventId: event.id,
        metadata: { eventStartAt: event.queueClosedAt, submissionDeadline: event.submissionDeadline },
      });
    }

    if (action === "joinEvent") {
      const artistId = String(body?.artistId || "");
      const eventId = String(body?.eventId || "");
      const artist = state.artists.find((entry) => entry.id === artistId);
      const event = state.events.find((entry) => entry.id === eventId);

      if (!artist || !event) {
        return NextResponse.json({ error: "Artist and event are required." }, { status: 400 });
      }

      const eventEntries = state.entries.filter((entry) => entry.eventId === eventId);
      if (event.phase !== "queue") {
        return NextResponse.json({ error: "This event queue is closed." }, { status: 409 });
      }

      if (eventEntries.length >= ARTISTS_PER_EVENT) {
        return NextResponse.json({ error: "This event already has 16 artists." }, { status: 409 });
      }

      if (state.entries.some((entry) => entry.artistId === artistId)) {
        return NextResponse.json({ error: "Artist is already queued in an MVP event." }, { status: 409 });
      }

      if (artist.walletCents < event.entryFeeCents) {
        return NextResponse.json({ error: "Artist wallet does not have enough funds." }, { status: 409 });
      }

      if (artist.betaRulesVersion !== BETA_RULES_VERSION || !artist.betaRulesAcceptedAt) {
        if (!body?.acceptBetaRules) {
          return NextResponse.json({ error: "Accept the beta rules before joining a paid event." }, { status: 409 });
        }

        artist.betaRulesVersion = BETA_RULES_VERSION;
        artist.betaRulesAcceptedAt = new Date().toISOString();
        logProtocolEvent(state, "beta_rules_accepted", `${artist.name} accepted beta event rules.`, {
          artistId: artist.id,
          eventId,
          metadata: { betaRulesVersion: BETA_RULES_VERSION },
        });
      }

      artist.walletCents -= event.entryFeeCents;
      artist.status = "queued";
      const nextEntry: ProtocolEntry = {
        id: makeId(),
        eventId,
        artistId,
        seed: eventEntries.length + 1,
        paidCents: event.entryFeeCents,
        status: "queued",
        joinedAt: new Date().toISOString(),
      };

      state.entries.push(nextEntry);
      state.walletLedger.push({
        id: makeId(),
        artistId,
        eventId,
        amountCents: -event.entryFeeCents,
        type: "entry_fee",
        note: `Entry fee for ${event.title}`,
        createdAt: new Date().toISOString(),
      });
      logProtocolEvent(state, "artist_joined_event", `${artist.name} joined ${event.title}.`, {
        eventId,
        artistId,
        metadata: { seed: nextEntry.seed, entryFeeCents: event.entryFeeCents },
      });

      lockEventQueue(state, eventId);
    }

    if (action === "closeQueue") {
      const eventId = String(body?.eventId || "");
      if (!lockEventQueue(state, eventId)) {
        return NextResponse.json({ error: "Queue needs exactly 16 artists before it closes." }, { status: 409 });
      }
    }

    if (action === "submit") {
      const artistId = String(body?.artistId || "");
      const eventId = String(body?.eventId || "");
      const title = String(body?.title || "").trim();
      const audioUrl = String(body?.audioUrl || "").trim();
      const durationSeconds = Math.round(Number(body?.durationSeconds || 0));
      const event = state.events.find((entry) => entry.id === eventId);
      const entry = state.entries.find((eventEntry) => eventEntry.eventId === eventId && eventEntry.artistId === artistId);

      if (!event || !entry || title.length < 2 || !audioUrl) {
        return NextResponse.json({ error: "Event, artist, title, and audio link are required." }, { status: 400 });
      }

      if (durationSeconds < 1 || durationSeconds > SUBMISSION_LIMIT_SECONDS) {
        return NextResponse.json({ error: "Submission must be 3 minutes or less." }, { status: 409 });
      }

      if (event.phase !== "submission" || event.currentRound !== 1 || pilotClock(state)
        || (event.queueClosedAt && Date.parse(event.queueClosedAt) > Date.now())
        || (event.submissionDeadline && Date.parse(event.submissionDeadline) <= Date.now())) {
        return NextResponse.json({ error: "The single-track submission window is closed." }, { status: 409 });
      }

      const existing = state.submissions.find(
        (submission) => submission.eventId === eventId && submission.artistId === artistId,
      );

      const nextSubmission = {
        id: existing?.id || makeId(),
        eventId,
        artistId,
        round: event.currentRound,
        title,
        audioUrl,
        durationSeconds,
        submittedAt: existing?.submittedAt || new Date().toISOString(),
      };

      state.submissions = state.submissions.filter((submission) => submission.id !== existing?.id);
      state.submissions.push(nextSubmission);
      const artist = state.artists.find((entryArtist) => entryArtist.id === artistId);
      if (artist) {
        artist.status = "submitted";
      }
      logProtocolEvent(state, "submission_received", `${artist?.name || artistId} submitted ${title}.`, {
        eventId,
        artistId,
        metadata: { round: event.currentRound, submissionId: nextSubmission.id, title },
      });

      advancePilot(state);
    }

    if (action === "generateJudgeAssignments") {
      const eventId = String(body?.eventId || "");
      const event = state.events.find((entry) => entry.id === eventId);

      if (!event) {
        return NextResponse.json({ error: "Event is required." }, { status: 400 });
      }

      autoAdvanceProtocol(state);
    }

    if (action === "judge") {
      const assignmentId = String(body?.assignmentId || "");
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);

      if (!assignment) {
        return NextResponse.json({ error: "Assignment is required." }, { status: 400 });
      }

      const battle = state.battles.find((entry) => entry.id === assignment.battleId);
      if (!battle) {
        return NextResponse.json({ error: "Battle is invalid." }, { status: 400 });
      }

      if (!["assigned", "opened"].includes(assignment.status) || battle.status === "complete") {
        return NextResponse.json({ error: "This card has already been locked or resolved." }, { status: 409 });
      }
      if (!assignment.dueAt || Date.now() >= Date.parse(assignment.dueAt)) {
        return NextResponse.json({ error: "This 15-minute judging window expired." }, { status: 409 });
      }
      const recorded = recordSliderJudgment(state, assignment, battle, body?.sliders, body?.events);
      if ("error" in recorded) return NextResponse.json({ error: recorded.error }, { status: recorded.status });
      assignment.status = "completed";
      assignment.completedAt = recorded.judgment.createdAt;
      logProtocolEvent(state, "vote_recorded", "FateKeeper judgment sealed until the wave deadline.", {
        eventId: battle.eventId,
        artistId: assignment.judgeArtistId,
        metadata: { assignmentId, battleId: battle.id },
      });
    }

    if (action === "finalizeRound") {
      autoAdvanceProtocol(state);
    }

    await persistState(state);
    return NextResponse.json(visiblePayload(state, principal, principal.host ? await readWorkerHealth() : null), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AccessError ? error.message : "Protocol action failed." }, { status: error instanceof AccessError ? error.status : error instanceof StateConflictError ? 409 : 500 });
  }
}
