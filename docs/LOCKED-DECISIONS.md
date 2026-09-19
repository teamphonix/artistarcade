# Artist Arcade — Locked Product Decisions

This file records product decisions that override speculative details appearing in AI-generated concept art. The Product Bible remains the broad source of truth; these decisions are explicit implementation constraints.

## 1. Hidden Tournament Population / Public Prize Language

The internal MVP protocol uses 16 artists per event queue. **The number 16 is secret operational logic and must never be exposed to users.**

Publicly, an entrant is told only the value proposition:

- **1 in 5 wins the prize.**
- The winner receives **5× the entry amount**.

The user experience should make the prize feel like the result of the visible 1-in-5 proposition. Do not display queue size, entrant count, bracket population, "X of 16," or any copy that reveals the 16-person funding/queue structure.

The backend may use 16 internally for queue lock, bracket generation, judging distribution, and economics. Frontend/API responses intended for ordinary users should avoid leaking this number.

## 2. Final MVP Scoring Weights

The current code weights are final:

- Lyrics — 25%
- Delivery — 20%
- Originality — 20%
- Flow — 15%
- Impact — 20%

Do not substitute weights shown in concept images.

## 3. FateKeeper Scoring Interaction

The preferred FateKeeper interaction is **one comparative slider per scoring category** between Artist A and Artist B.

Each category slider expresses the FateKeeper's comparative judgment between the two submissions. The five weighted category positions collectively calculate the overall Artist A / Artist B battle percentage.

The same aggregate percentage drives the central battle-energy meter used by:
- the live Spectator visualization; and
- the completed Contender playback.

## 4. Judgment Timeline / Replay Requirement

A final score alone is insufficient for the intended visual experience.

The system should preserve timestamped judgment-state changes during an active FateKeeper session so the battle can be visualized live and reconstructed later. At minimum, the event stream should be capable of recording:

- battle/assignment identifier;
- server timestamp or elapsed judgment time;
- submission playback state where relevant;
- category changed;
- comparative slider value after the change;
- resulting weighted Artist A / Artist B aggregate;
- final judgment lock and winner.

The Spectator consumes this stream live. The Contender receives the same sequence as a completed playback only after the relevant judgment/event result is available under the blind-progression rules.

Exact sampling/debouncing/storage implementation is an engineering decision; the product requirement is that meaningful scoring changes can be faithfully replayed without recording every pointer movement.

## 5. Avatar Customization — MVP

Avatar customization is intentionally **lightweight** for Season Zero.

The MVP should establish identity and demonstrate the future customization system without building a full character creator or large inventory economy.

Target scope:
- small starter avatar/body selection;
- limited hood/mask choices;
- limited aura/accent choices;
- equipped finishing move;
- artist name/basic identity.

Archetypes, large gear catalogs, stores, complex inventory systems, and extensive cosmetic economies shown in concept art are not automatically MVP requirements.

## 6. Money Vocabulary

Season Zero uses **dollars**. There is no required Arena Coin, REP currency, token exchange, or multi-currency economy.

Concept-art displays of Coins/REP/etc. are visual speculation unless separately approved.

Long-term exploration may include a purpose-built smart-contract/token/crypto layer, subject to product, legal, regulatory, security, and economic design review. It is not an MVP dependency.

## 7. Finishing Moves — MVP

Season Zero should target **three finishing moves** so users can understand that finishers are an identity/customization feature rather than a one-off animation.

One established concept is the **Scroll Crush**:
- winner launches an enchanted written scroll;
- scroll wraps and constricts the defeated avatar;
- musical energy/notes escape;
- defeated avatar fractures/deteriorates;
- elimination completes.

The other two finishing moves require creative design.

For implementation, finishers should be reusable animation/effect templates driven by battle result data (winner avatar, loser avatar, equipped finisher), not bespoke videos generated after every battle.

A practical MVP implementation can use layered 2D/2.5D character rigs, masks, particles, shaders/CSS/WebGL/canvas effects, and pre-authored animation timelines. Full 3D fighting-game character animation is not required to prove the feature.

## 8. Concept Art Rule

AI-generated concept screens are **visual references, not feature specifications**.

If a concept image contains an unapproved feature, number, currency, rank rule, entrant count, score weight, reward, bracket format, "best of" format, store item, or other mechanic, it must not be treated as product truth.

Product rules come from the Product Bible and explicit locked-decision documentation.
