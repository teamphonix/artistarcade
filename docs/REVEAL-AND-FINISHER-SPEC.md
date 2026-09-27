# Reveal + Scroll Crush — Season Zero Spec

This is the first product-layer spec we implement against. It does not invent currencies, ranks, Create Event, Training Grounds, or live Contender self-watch.

Overrides: `LOCKED-DECISIONS.md`.

---

## What exists today

Protocol phases: `queue` → `submission` → `judging` → `complete`.

Artist statuses: `registered | queued | submitted | judging | advanced | eliminated | winner`.

Battle statuses: `pending | judging | complete`.

Judgment is a **final scorecard** (`scores` and optional `contestantScores`) plus `selectedWinnerArtistId`. There is **no judgment timeline**. Results Room is a ledger page: winner copy, weighted totals, category gaps, audio playback. No seal. No meter replay. No finisher.

Host can close queue, tick, assign judges, finalize round, reset. Host is not the game.

---

## LOCKED DECISION — three rooms, three truths

| Role | When they see the battle | What they see |
|---|---|---|
| FateKeeper | During the 15-minute assignment window | Comparative sliders. Live preview meter. Submit locks judgment. |
| Spectator | While FateKeeper is judging (and replay after) | Same meter driven by the judgment timeline. No sliders. |
| Contender | Only after the battle is `complete` | Same timeline as a **playback**, then finisher, then dollars. |

Contender never watches their own battle live. Frame `14-contender-live-watch-CONFLICT.png` is banned as a live feature.

---

## LOCKED DECISION — comparative math

Five sliders. One per locked category.

Weights: Lyrics 25, Delivery 20, Originality 20, Flow 15, Impact 20.

Each slider is an integer `0–100`:

- `0` = all of that category to Artist A
- `50` = even
- `100` = all of that category to Artist B

```
A_points = Σ weight_i * (100 - slider_i) / 100
B_points = Σ weight_i * slider_i / 100
A_pct    = round(A_points)
B_pct    = 100 - A_pct
```

Winner = higher points. Tie → FateKeeper must move at least one slider off 50 before lock. Protocol must refuse a lock at 50/50.

Do **not** use independent 1–10 scorecards for new judgments. Legacy `contestantScores` may still exist on old pilot rows; new writes use sliders only.

Implementation: `src/app/lib/scoring.ts`.

---

## LOCKED DECISION — judgment timeline

Persist settled slider changes, not pointer chatter.

Debounce: 250ms after the slider stops, or immediately on lock.

Event shape:

```ts
{
  id: string
  battleId: string
  assignmentId: string
  tMs: number              // ms since assignment opened
  type: "open" | "slider" | "lock"
  category?: ScoreKey
  sliders: Record<ScoreKey, number>
  aPct: number
  bPct: number
}
```

Spectator subscribes live. Contender gets the frozen array only after `battle.status === "complete"`.

---

## LOCKED DECISION — Reveal state machine

One machine. Same beats for Spectator replay and Contender first-watch. Only the *entry condition* differs.

```
SEALED → GATES → INTRO → METER → LOCK → FINISHER → OUTCOME → REST
```

| Phase | Duration (MVP target) | What happens |
|---|---|---|
| SEALED | until battle complete (Contender) or assignment open (Spectator) | Hooded arena. No names of the result. Copy: "Fate is being written." |
| GATES | 1.2s | Arena doors / dark flash. |
| INTRO | 2.0s | Both avatars, names, challenge title. No percentages yet. |
| METER | timeline length (min 4s, cap 16s) | Replay judgment events into the center energy meter. |
| LOCK | 1.0s | Meter slams to final A/B split. |
| FINISHER | 4.0s | Equipped template. Season Zero default: `scroll_crush`. |
| OUTCOME | hold | Winner / defeated. Dollars only. 5× entry if event winner. |
| REST | — | Results Room under the cinematic, not instead of it. |

Skip rules:
- If timeline is empty (legacy judgment), METER is a 2s lerp from 50/50 to final split.
- If user taps "Skip ceremony" after first full watch, jump to OUTCOME. First watch is not skippable.

Public copy on OUTCOME:
- Winner of a battle: "You advance."
- Event winner: "You take the prize. 5× your entry."
- Eliminated: "Your run ends here."
- Never show queue size, seed, or "16".

---

## LOCKED DECISION — Scroll Crush template

Reusable. Driven by `{ winnerAvatar, loserAvatar, winnerName, loserName }`.

Beats (4.0s):

1. 0.0–0.6 — winner raises a written scroll.
2. 0.6–1.6 — scroll flies, wraps the loser.
3. 1.6–2.6 — scroll constricts; notes/glyphs leak off the loser.
4. 2.6–3.6 — loser fractures / ash.
5. 3.6–4.0 — hold on winner.

Implementation for MVP: CSS/canvas layers + a sprite sheet or Lottie-like timeline. Not a unique video per battle. Not 3D MK.

Two other finisher IDs are reserved, unnamed:
- `finisher_02`
- `finisher_03`

Do not design them until Scroll Crush plays in the product.

Default equipped finisher for Season Zero = `scroll_crush`.

---

## What we will not build in this slice

- Create Event
- Coins / REP / XP / Arena Pass
- Rank ladder math
- Training Grounds
- Full Forge catalog
- Best of 3
- Visible field size
- Contender live self-watch
- 3D character engine

---

## Engineering adoption order

1. Land `scoring.ts` and use it on new FateKeeper writes. Stop writing independent 1–10 cards.
2. Add `judgmentEvents[]` to protocol state. Write on slider settle + lock.
3. Split `/api/pilot` public vs host payloads so ordinary clients never receive `artistsPerEvent: 16` or seed maps.
4. Build Reveal machine as a client component fed by a completed battle + timeline.
5. Implement `scroll_crush` as the FINISHER phase.
6. Replace Results Room first-paint with Reveal, then REST into the existing ledger.

Host console stays an override. It does not become the game.
