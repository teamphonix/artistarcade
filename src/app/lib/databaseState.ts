import type { ProtocolState } from "./pilotStore";

const defaultNotificationPreferences = () => ({ inApp: true, email: false, sms: false, push: false });

export function toDatabaseRows(state: ProtocolState) {
  return {
    protocol_artists: state.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      email: artist.email,
      wallet_cents: artist.walletCents,
      reward_cents: artist.rewardCents,
      status: artist.status,
      notification_preferences: artist.notificationPreferences || defaultNotificationPreferences(),
      beta_rules_accepted_at: artist.betaRulesAcceptedAt || null,
      beta_rules_version: artist.betaRulesVersion || null,
      created_at: artist.createdAt,
    })),
    protocol_events: state.events.map((event) => ({
      id: event.id,
      title: event.title,
      event_type: event.eventType,
      creator_artist_id: event.creatorArtistId,
      desired_prize_cents: event.desiredPrizeCents,
      entry_fee_cents: event.entryFeeCents,
      challenge_title: event.challengeTitle,
      challenge_description: event.challengeDescription,
      challenge_audio_url: event.challengeAudioUrl,
      phase: event.phase,
      current_round: event.currentRound,
      queue_opened_at: event.queueOpenedAt,
      queue_closed_at: event.queueClosedAt,
      submission_deadline: event.submissionDeadline,
      judging_deadline: event.judgingDeadline,
      winner_artist_id: event.winnerArtistId,
      company_revenue_cents: event.companyRevenueCents,
    })),
    protocol_entries: state.entries.map((entry) => ({
      id: entry.id,
      event_id: entry.eventId,
      artist_id: entry.artistId,
      seed: entry.seed,
      paid_cents: entry.paidCents,
      status: entry.status,
      joined_at: entry.joinedAt,
    })),
    protocol_submissions: state.submissions.map((submission) => ({
      id: submission.id,
      event_id: submission.eventId,
      artist_id: submission.artistId,
      round: submission.round,
      title: submission.title,
      audio_url: submission.audioUrl,
      duration_seconds: submission.durationSeconds,
      submitted_at: submission.submittedAt,
    })),
    protocol_battles: state.battles.map((battle) => ({
      id: battle.id,
      event_id: battle.eventId,
      round: battle.round,
      slot: battle.slot,
      artist_a_id: battle.artistAId,
      artist_b_id: battle.artistBId,
      status: battle.status,
      winner_artist_id: battle.winnerArtistId,
      created_at: battle.createdAt,
      completed_at: battle.completedAt,
    })),
    protocol_assignments: state.assignments.map((assignment) => ({
      id: assignment.id,
      battle_id: assignment.battleId,
      judge_artist_id: assignment.judgeArtistId,
      status: assignment.status,
      assigned_at: assignment.assignedAt,
      opened_at: assignment.openedAt,
      due_at: assignment.dueAt,
      completed_at: assignment.completedAt,
    })),
    protocol_judgments: state.judgments.map((judgment) => ({
      id: judgment.id,
      assignment_id: judgment.assignmentId,
      battle_id: judgment.battleId,
      judge_artist_id: judgment.judgeArtistId,
      lyrics: judgment.scores.lyrics,
      delivery: judgment.scores.delivery,
      originality: judgment.scores.originality,
      flow: judgment.scores.flow,
      impact: judgment.scores.impact,
      contestant_scores: judgment.contestantScores || null,
      sliders: judgment.sliders || null,
      timeline: judgment.events || [],
      selected_winner_artist_id: judgment.selectedWinnerArtistId,
      created_at: judgment.createdAt,
    })),
    protocol_wallet_ledger: state.walletLedger.map((entry) => ({
      id: entry.id,
      artist_id: entry.artistId,
      event_id: entry.eventId,
      amount_cents: entry.amountCents,
      type: entry.type,
      note: entry.note,
      created_at: entry.createdAt,
    })),
    protocol_audit_log: (state.auditLog || []).map((entry) => ({
      id: entry.id,
      event_id: entry.eventId,
      artist_id: entry.artistId,
      action: entry.action,
      note: entry.note,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    })),
  };
}

export type DatabaseRows = ReturnType<typeof toDatabaseRows>;
export type ProtocolTable = keyof DatabaseRows;
export const PROTOCOL_TABLES = ["protocol_artists", "protocol_events", "protocol_entries", "protocol_submissions", "protocol_battles", "protocol_assignments", "protocol_judgments", "protocol_wallet_ledger", "protocol_audit_log"] as const;

export class StateConflictError extends Error {
  constructor() { super("The tournament changed while this request was saving. Refresh and retry."); }
}

const baselines = new WeakMap<ProtocolState, DatabaseRows>();

export function rememberSnapshot(state: ProtocolState, revision: number) {
  state.revision = revision;
  baselines.set(state, structuredClone(toDatabaseRows(state)));
  return state;
}

export function buildStatePatch(state: ProtocolState) {
  const baseline = baselines.get(state);
  const rows = toDatabaseRows(state);
  const patch: Partial<Record<ProtocolTable, unknown[]>> = {};
  for (const table of PROTOCOL_TABLES) {
    const before = new Map((baseline?.[table] || []).map(row => [row.id, JSON.stringify(row)]));
    // Routine commits only insert/update. Missing IDs never cause deletion.
    const changed = rows[table].filter(row => before.get(row.id) !== JSON.stringify(row));
    if (changed.length) patch[table] = changed;
  }
  return patch;
}
