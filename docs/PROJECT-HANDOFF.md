# Artist Arcade — Project Handoff

**Repository:** `teamphonix/artistarcade`
**Branch:** `main`

## Current authoritative sources

1. `docs/PRODUCT-BIBLE.md`
2. `docs/LOCKED-DECISIONS.md`
3. `docs/autonomous-protocol.md`
4. `docs/REVEAL-AND-FINISHER-SPEC.md`
5. `docs/BUILD-ORDER.md`
6. `docs/mvp-setup.md`
7. `docs/live-pilot-accounts.md`
8. `docs/CONCEPT-ART-MANIFEST.md`
9. `AGENTS.md`

**Conflict rule:** `LOCKED-DECISIONS.md` overrides concept art. Reveal beats come from `REVEAL-AND-FINISHER-SPEC.md`.

## Locked

- Hidden 16. Public: 1 in 5 wins, 5× entry, dollars only.
- Scoring weights: 25 / 20 / 20 / 15 / 20.
- Comparative sliders 0–100 A→B. No 50/50 lock.
- Judgment timeline required.
- Reveal: SEALED → GATES → INTRO → METER → LOCK → FINISHER → OUTCOME → REST.
- Default finisher: `scroll_crush`. Two more IDs reserved, unnamed.
- Light avatars. Create Event is live-platform, not MVP.
- Contender does not watch their own battle live.

## In repo now

- Concept art frames: `public/assets/concept-art/`
- Scoring helper: `src/app/lib/scoring.ts` (not yet wired into FateKeeper writes)

## Next slice

Slice 1: FateKeeper sliders write `judgmentEvents` and refuse ties.
Then Slice 2: strip 16 from public payloads.
Then Reveal client. Then Scroll Crush.
