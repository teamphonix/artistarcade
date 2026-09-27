# Season Zero — Build Order

Do these in order. Do not start cinematic chrome before the data can drive it.

## Slice 0 — Spec — DONE
- Reveal + Scroll Crush spec
- Comparative scoring helper

## Slice 1 — Judgment writes the fight — IN PROGRESS
- Protocol state has `judgmentEvents` and judgment `sliders` / `events` (`pilotStore.ts` on main).
- FateKeeper UI: five 0–100 A-vs-B sliders (event room patch).
- Live A/B preview meter from `aggregateFromSliders`.
- Persist `judgmentEvents` on settle + lock.
- Refuse 50/50 lock (`action === "judge"` now requires `sliders`).

Judge POST body:
```
{ action: "judge", assignmentId, sliders, events }
```
Server rejects ties with 409.

## Slice 2 — Public protocol hygiene
- Strip `16`, seeds, and queue population from artist/spectator payloads
- Public language only: 1 in 5, 5×, dollars
- Keep 16 inside host + tick only

## Slice 3 — Duty / timeout
- 15 minutes after assignment opened
- Expired assignment auto-resolves

## Slice 4 — Reveal client
## Slice 5 — Scroll Crush
## Slice 6 — Wire Results Room

## Not this season
Create Event, ranks, coins, Training Grounds, 3D, user Prize Board marketplace.
