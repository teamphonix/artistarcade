import { buildStatePatch, rememberSnapshot, StateConflictError, type DatabaseRows } from "./databaseState";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readPilotState, seedPilotState, writePilotState, type ProtocolState } from "./pilotStore";
const defaultNotificationPreferences = () => ({ inApp: true, email: false, sms: false, push: false });

async function readSupabaseState() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return readPilotState();
  }

  const { data: snapshot, error } = await supabase.rpc("protocol_read_snapshot");
  if (error) throw new Error("Protocol snapshot failed. Apply the atomic persistence migration before enabling this build: " + error.message);
  const artistsResult = { data: snapshot.tables.protocol_artists as DatabaseRows["protocol_artists"] };
  const eventsResult = { data: snapshot.tables.protocol_events as DatabaseRows["protocol_events"] };
  const entriesResult = { data: snapshot.tables.protocol_entries as DatabaseRows["protocol_entries"] };
  const submissionsResult = { data: snapshot.tables.protocol_submissions as DatabaseRows["protocol_submissions"] };
  const battlesResult = { data: snapshot.tables.protocol_battles as DatabaseRows["protocol_battles"] };
  const assignmentsResult = { data: snapshot.tables.protocol_assignments as DatabaseRows["protocol_assignments"] };
  const judgmentsResult = { data: snapshot.tables.protocol_judgments as DatabaseRows["protocol_judgments"] };
  const walletLedgerResult = { data: snapshot.tables.protocol_wallet_ledger as DatabaseRows["protocol_wallet_ledger"] };
  const auditLogResult = { data: snapshot.tables.protocol_audit_log as DatabaseRows["protocol_audit_log"] };

  const state: ProtocolState = {
    settings: seedPilotState.settings,
    artists: (artistsResult.data || []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      email: artist.email,
      walletCents: artist.wallet_cents,
      rewardCents: artist.reward_cents,
      status: artist.status,
      notificationPreferences: artist.notification_preferences || defaultNotificationPreferences(),
      betaRulesAcceptedAt: artist.beta_rules_accepted_at,
      betaRulesVersion: artist.beta_rules_version,
      createdAt: artist.created_at,
    })),
    events: (eventsResult.data || []).map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.event_type,
      creatorArtistId: event.creator_artist_id,
      desiredPrizeCents: event.desired_prize_cents,
      entryFeeCents: event.entry_fee_cents,
      challengeTitle: event.challenge_title,
      challengeDescription: event.challenge_description,
      challengeAudioUrl: event.challenge_audio_url,
      phase: event.phase,
      currentRound: event.current_round,
      queueOpenedAt: event.queue_opened_at,
      queueClosedAt: event.queue_closed_at,
      submissionDeadline: event.submission_deadline,
      judgingDeadline: event.judging_deadline,
      winnerArtistId: event.winner_artist_id,
      companyRevenueCents: event.company_revenue_cents,
    })),
    entries: (entriesResult.data || []).map((entry) => ({
      id: entry.id,
      eventId: entry.event_id,
      artistId: entry.artist_id,
      seed: entry.seed,
      paidCents: entry.paid_cents,
      status: entry.status,
      joinedAt: entry.joined_at,
    })),
    submissions: (submissionsResult.data || []).map((submission) => ({
      id: submission.id,
      eventId: submission.event_id,
      artistId: submission.artist_id,
      round: submission.round,
      title: submission.title,
      audioUrl: submission.audio_url,
      durationSeconds: submission.duration_seconds,
      submittedAt: submission.submitted_at,
    })),
    battles: (battlesResult.data || []).map((battle) => ({
      id: battle.id,
      eventId: battle.event_id,
      round: battle.round,
      slot: battle.slot,
      artistAId: battle.artist_a_id,
      artistBId: battle.artist_b_id,
      status: battle.status,
      winnerArtistId: battle.winner_artist_id,
      createdAt: battle.created_at,
      completedAt: battle.completed_at,
    })),
    assignments: (assignmentsResult.data || []).map((assignment) => ({
      id: assignment.id,
      battleId: assignment.battle_id,
      judgeArtistId: assignment.judge_artist_id,
      status: assignment.status,
      assignedAt: assignment.assigned_at,
      openedAt: assignment.opened_at,
      dueAt: assignment.due_at,
      completedAt: assignment.completed_at,
    })),
    judgments: (judgmentsResult.data || []).map((judgment) => ({
      id: judgment.id,
      assignmentId: judgment.assignment_id,
      battleId: judgment.battle_id,
      judgeArtistId: judgment.judge_artist_id,
      scores: {
        lyrics: judgment.lyrics,
        delivery: judgment.delivery,
        originality: judgment.originality,
        flow: judgment.flow,
        impact: judgment.impact,
      },
      contestantScores: judgment.contestant_scores || undefined,
      sliders: judgment.sliders || undefined,
      events: judgment.timeline || undefined,
      selectedWinnerArtistId: judgment.selected_winner_artist_id,
      createdAt: judgment.created_at,
    })),
    walletLedger: (walletLedgerResult.data || []).map((entry) => ({
      id: entry.id,
      artistId: entry.artist_id,
      eventId: entry.event_id,
      amountCents: entry.amount_cents,
      type: entry.type,
      note: entry.note,
      createdAt: entry.created_at,
    })),
    auditLog: (auditLogResult.data || []).map((entry) => ({
      id: entry.id,
      eventId: entry.event_id,
      artistId: entry.artist_id,
      action: entry.action,
      note: entry.note,
      metadata: entry.metadata || {},
      createdAt: entry.created_at,
    })),
  };

  state.judgmentEvents = state.judgments.flatMap(judgment => judgment.events || []);
  rememberSnapshot(state, Number(snapshot.revision));
  if (state.artists.length === 0 && state.events.length === 0) {
    Object.assign(state, structuredClone(seedPilotState), { revision: Number(snapshot.revision) });
    // Demo seed credits are not backed by USD. Production starts every wallet at zero.
    state.artists.forEach(artist => { artist.walletCents = 0; artist.rewardCents = 0; });
    await writeSupabaseState(state);
    return state;
  }
  return state;
}

async function writeSupabaseState(state: ProtocolState) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Atomic protocol persistence requires Supabase.");
  if (!Number.isSafeInteger(state.revision)) throw new Error("Protocol snapshot revision is required.");
  const { data, error } = await supabase.rpc("protocol_commit", {
    p_expected_revision: state.revision,
    p_patch: buildStatePatch(state),
  });
  if (error?.code === "40001" || error?.code === "40P01") throw new StateConflictError();
  if (error) throw new Error(error.message);
  rememberSnapshot(state, Number(data));
}

export async function loadState() {
  if (getSupabaseAdmin()) return readSupabaseState();
  if (process.env.NODE_ENV === "production") throw new Error("Supabase is required in production; local wallets are demo-only.");
  return readPilotState();
}

export async function persistState(state: ProtocolState) {
  if (getSupabaseAdmin()) {
    await writeSupabaseState(state);
    return;
  }

  await writePilotState(state);
}
