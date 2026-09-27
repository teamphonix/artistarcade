# Season Zero — Build Order

Do these in order. Do not start cinematic chrome before the data can drive it.

## Slice 0 — Spec (this commit)
- Reveal + Scroll Crush spec
- Comparative scoring helper

## Slice 1 — Judgment writes the fight
- FateKeeper UI: five 0–100 A-vs-B sliders
- Live A/B preview meter from `aggregateFromSliders`
- Persist `judgmentEvents` on settle + lock
- Refuse 50/50 lock

## Slice 2 — Public protocol hygiene
- Strip `16`, seeds, and queue population from artist/spectator payloads
- Public language only: 1 in 5, 5×, dollars
- Keep 16 inside host + tick only

## Slice 3 — Duty / timeout (already described, not fully enforced)
- 15 minutes after assignment opened
- Expired assignment auto-resolves so the event cannot deadlock
- Non-compliance path for a FateKeeper who is also an active Contender elsewhere — implement only as specified in autonomous-protocol.md, do not invent extra punishment

## Slice 4 — Reveal client
- State machine component
- SEALED → … → REST
- Empty-timeline fallback lerp

## Slice 5 — Scroll Crush
- 4s template on FINISHER
- Default equipped id `scroll_crush`

## Slice 6 — Wire Results Room
- First visit after a completed battle plays Reveal once
- Then existing ledger underneath

## Not this season
Create Event, ranks, coins, Training Grounds, 3D, user Prize Board marketplace.
