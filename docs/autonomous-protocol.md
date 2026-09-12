# Autonomous Protocol Notes

> Product behavior and terminology are governed by [`PRODUCT-BIBLE.md`](PRODUCT-BIBLE.md).

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
- Judging assignments are distributed automatically to eligible artists outside the event being judged.
- An artist may not judge their own event/submission.
- Assigned FateKeepers have a 15-minute judging window after opening the assignment.
- Expired judging assignments auto-resolve through the protocol fallback path so a missing FateKeeper cannot deadlock an event.
- Failure to complete required judging can automatically eliminate the non-compliant artist from their own active competition path.
- Completed battles advance the event to the next round or final winner.
- Round-by-round advancement remains blind to Contenders until the result/reveal experience is available.

## Battle Experience Timing

The protocol separates the three user perspectives:

- **FateKeeper:** creates the official judgment during the active judging window.
- **Spectator:** future live Arena experience showing the judgment visualization as it occurs.
- **Contender:** future completed-battle playback showing the already-decided judgment, score influence, outcome, and finishing move after judging is complete.

The live spectator visualization and cinematic contender playback are product-layer roadmap items; the protocol must preserve enough judgment/audit data to support them.

## Audit Trail

The protocol records durable audit events in `protocol_audit_log` and exposes the latest entries as `auditLog` from `/api/pilot`.

Tracked actions include:

- artist registration
- wallet deposit and withdrawal
- event setup changes
- artist joining an event
- queue auto-lock
- submission received
- judging opened
- FateKeeper assignment
- vote recorded
- expired judging auto-resolution
- non-compliance elimination where applicable
- round advancement
- event completion and prize ledgering

## Still Needed / Product-Layer Roadmap

- Real payment rails for wallet deposit and withdrawal.
- Real notification provider for queue locked, submissions open, judging assigned, results ready, and winner paid.
- Durable production database as the source of truth.
- Stronger anti-collusion rules for FateKeeper assignment.
- Audit/event log visible to admins and eventually artists.
- FateKeeper Training Grounds after a trusted calibration dataset exists.
- EXP/rank computation after the formula is validated.
- Spectator live visualization and post-result audience calibration vote.
- Contender cinematic battle playback and finishing-move rendering.
