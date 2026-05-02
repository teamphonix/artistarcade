# Autonomous Protocol Notes

Artist Arcade should behave like a protocol state machine. The host console is an override and inspection surface, not the thing that keeps the event alive.

## Current Tick

Production scheduling is configured in `vercel.json`.

- Route: `/api/protocol/tick`
- Schedule: every 5 minutes
- Security: set `CRON_SECRET` in Vercel. Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.

The tick route calls `/api/pilot`, which advances protocol state before returning the payload.

## Automatic Transitions

- When an event queue reaches 16 artists, the queue locks.
- The event moves to `submission`.
- Submission deadline is 24 hours from the event start time.
- When all current-round artists submit, the event moves to `judging`.
- Judging assignments are distributed automatically.
- Assigned judges have a 15-minute judging window.
- Expired judging assignments auto-resolve.
- Completed battles advance the event to the next round or final winner.

## Still Needed

- Real payment rails for wallet deposit and withdrawal.
- Real notification provider for queue locked, submissions open, judging assigned, results ready, and winner paid.
- Durable production database as the source of truth.
- Stronger anti-collusion rules for judge assignment.
- Audit/event log visible to admins and eventually artists.
