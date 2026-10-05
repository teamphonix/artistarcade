import { StateConflictError } from "./databaseState";
import { loadState, persistState } from "./protocolPersistence";
import { autoAdvanceProtocol } from "./protocolEngine";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Revision checks arbitrate concurrent workers and artist requests in the database.
// A conflict reloads the newest snapshot; a failed write never acknowledges success.
export async function runProtocolWorker() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The background worker requires Supabase.");
  const startedAt = new Date().toISOString();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const state = await loadState();
        const changed = autoAdvanceProtocol(state);
        if (changed) await persistState(state);
        const { error } = await admin.rpc("protocol_record_worker", {
          p_started_at: startedAt, p_success: true, p_revision: state.revision ?? null,
        });
        if (error) throw new Error("Worker heartbeat could not be saved.");
        return { ok: true, changed, revision: state.revision ?? null, tickedAt: new Date().toISOString() };
      } catch (error) {
        if (!(error instanceof StateConflictError) || attempt === 2) throw error;
      }
    }
    throw new StateConflictError();
  } catch (error) {
    // Best effort only: database outages can also prevent failure telemetry.
    try { await admin.rpc("protocol_record_worker", { p_started_at: startedAt, p_success: false, p_revision: null }); } catch {}
    throw error;
  }
}

export type WorkerHealth = { last_attempt_at: string | null; last_success_at: string | null; last_failure_at: string | null; last_revision: number | null };
export async function readWorkerHealth(): Promise<WorkerHealth | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.from("protocol_worker_health").select("last_attempt_at,last_success_at,last_failure_at,last_revision").eq("singleton", true).single();
  return error ? null : data;
}

export function workerIsHealthy(health: WorkerHealth | null, now = Date.now()) {
  if (!health?.last_success_at) return false;
  const success = Date.parse(health.last_success_at);
  const failure = health.last_failure_at ? Date.parse(health.last_failure_at) : -Infinity;
  return Number.isFinite(success) && success <= now && now - success <= 120_000 && failure < success;
}
