# Artist Arcade — Project Handoff

**Repository:** `teamphonix/artistarcade`
**Branch:** `main`
**Purpose:** Preserve the current product truth so work can continue in another chat, coding environment, or agent without reconstructing the project from conversation history.

## Current authoritative sources

1. `docs/PRODUCT-BIBLE.md` — broad product direction.
2. `docs/LOCKED-DECISIONS.md` — explicit decisions that override AI-generated concept art and speculative UI details.
3. `docs/autonomous-protocol.md` — protocol/state-machine behavior.
4. `docs/mvp-setup.md` — current MVP setup.
5. `docs/live-pilot-accounts.md` — pilot account/test information.
6. `AGENTS.md` — repository agent guidance.

**Conflict rule:** Explicit locked decisions in `LOCKED-DECISIONS.md` override older/speculative concept-art language. Do not silently revive features because they appear in screenshots.

## Product truth locked in the latest design session

### Hidden queue / public economics

- Season Zero uses a hidden internal queue size of **16 artists** per event.
- **The number 16 must NEVER be exposed to ordinary users.**
- Never display entrant counts, queue progress, bracket population, or copy that reveals the hidden 16-person funding/queue structure.
- Public proposition: **1 in 5 wins the prize.**
- Winner prize is **5× the entrant's initial investment/entry amount.**
- Public-facing UX should make the visible proposition feel like a 1-in-5 competition; the internal queue mechanism remains backend protocol.
- This is a product/privacy-of-mechanics requirement, not merely a visual preference.

### Scoring

Final MVP category weights are locked:

| Category | Weight |
|---|---:|
| Lyrics | 25% |
| Delivery | 20% |
| Originality | 20% |
| Flow | 15% |
| Impact | 20% |

FateKeeper interaction is one **comparative slider per category** between Artist A and Artist B. The five weighted category positions collectively determine the aggregate battle percentage.

### Judgment timeline

The product must preserve meaningful judgment-state changes, not just the final score.

Record enough event data to reconstruct the judgment visualization:
- battle/assignment ID;
- server timestamp or elapsed judgment time;
- category changed;
- comparative slider value after the change;
- resulting weighted aggregate;
- final lock;
- winner.

Do not record every pointer movement merely for animation. Meaningful settled changes are sufficient.

The same judgment sequence powers:
- live Spectator visualization; and
- later Contender playback.

### Avatar MVP

Avatar customization is intentionally light:
- small starter body/avatar selection;
- limited hood/mask choices;
- limited aura/accent choices;
- artist identity;
- equipped finishing move.

Do not build a huge character creator, gear catalog, inventory economy, or random cosmetic systems for Season Zero.

### Money vocabulary

Season Zero uses **dollars**.

Do not require or expose Arena Coins, REP, stars, gems, token exchange, or similar fictional currencies in the MVP.

A future proprietary smart-contract/crypto system is an exploration item only and is not an MVP dependency.

### Finishing moves

Season Zero targets **three** finishing moves.

Established concept:
- **Scroll Crush:** an enchanted written scroll wraps/constricts the defeated avatar; musical energy escapes; the avatar fractures/deteriorates; elimination completes.

Two additional finishers remain to be designed.

Finishers should be reusable visual/animation templates driven by battle result data, not bespoke generated videos for every match. Practical MVP implementation can use layered 2D/2.5D rigs, masks, particles, shaders/CSS/WebGL/canvas effects and pre-authored timelines.

## Concept-art status

The concept images are **reference material, not specifications**.

The latest 10-image concept set supplied in the September 2026 design session includes:
1. Arena Hub / main menu
2. Spectator Hub
3. Arena Hub alternate
4. Entry Portals / Compete-Judge-Spectate
5. Prize Board
6. Defeat result
7. Victory result
8. Lyrical Onslaught battle
9. Rank Badges
10. FateKeeper Training Grounds

Important: these images are currently available in the ChatGPT conversation file surface, but **they are not all committed as binary image assets in this GitHub repository**. The repository currently contains only its existing brand assets under `public/brand/`.

The concept art must not be used to reintroduce:
- visible 16-person counts;
- fictional Coins/REP currencies;
- unapproved rank/XP formulas;
- unapproved stores/inventory;
- unapproved event populations;
- random AI-invented features;
- other UI mechanics that were not explicitly locked.

## Current repo implementation

The repository already contains a substantial Next.js/React MVP foundation with:
- Arena pages;
- artist/event/result pages;
- host console;
- pilot/protocol API;
- Stripe checkout/webhook;
- upload/waitlist endpoints;
- protocol tick;
- pilot store/protocol libraries;
- Supabase admin integration;
- existing brand assets.

Do not assume the existing implementation perfectly matches the latest product decisions. The next engineering pass should audit implementation against the locked decisions.

## Next product work, in order

1. **Reveal experience** — define exactly how a Contender discovers their completed journey after blind progression.
2. FateKeeper scoring behavior and deadline edge cases.
3. Non-compliant judging / timeout fallback details.
4. Full public-surface audit for hidden-16 leakage.
5. Final Season Zero avatar asset specification.
6. Finish the three-finisher creative/technical storyboard.
7. Judgment timeline/replay event schema.
8. Freeze the Season Zero screen inventory.
9. Annotate every concept screen KEEP / CHANGE / REMOVE / FUTURE.
10. Run a deterministic 64-artist end-to-end protocol simulation before heavy cinematic implementation.

## Important product philosophy

**The AI concept artist is allowed to explore. It is not the product manager.**

If a screenshot invents a number, currency, feature, rank, reward, bracket, button, or mechanic, treat it as visual exploration unless it appears in the authoritative product docs or is explicitly locked by the founder.

**The goal now is not to add more ideas. It is to turn the strongest ideas into a deterministic, testable Season Zero.**
