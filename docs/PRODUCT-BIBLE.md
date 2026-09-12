# The Artist Arcade — Product Bible

**Status:** Authoritative product direction for the current MVP and future roadmap.

> **Skill. Discipline. Truth.**

The Artist Arcade is a competitive creative platform that turns artistic creation into a game-like arena. Creators enter challenges, submit original work, judge other creators through a structured protocol, advance through tournament brackets, and compete for real prizes. The first realm is **Rhythm & Poetry**.

The core principle is simple: **the numbers do not count here. The work does.** Followers, clout, and popularity do not determine official outcomes.

---

## 1. Core Loop

**Enter → Create → Submit → Judge → Advance → Reveal → Reward**

A creator is both a **Contender** and an eligible **FateKeeper**. Participation includes a duty to complete assigned judgments. Competition and judging are parts of the same game loop.

---

## 2. Season Zero / MVP Structure

The current MVP is intentionally structured around four simultaneous tournaments so participants in one event can judge battles in the other event pools.

- **64 total artists**
- **4 simultaneous events**
- **16 artists per event**
- **Single-elimination bracket**
- **4 rounds per event:** 16 → 8 → 4 → 2 → 1
- **15 battles per event / 60 battles total**
- Each artist competes in **one** event.
- Artists are eligible for judging assignments from the **other three event pools**.
- An artist may never judge a battle involving their own submission or their own event.
- Current MVP implementation uses **one FateKeeper per battle**.
- Submission maximum: **3:00**.
- Current submission window: **24 hours after queue lock**.
- Current FateKeeper judging window: **15 minutes after opening an assignment**.

The four seeded MVP challenge/event types are:

1. **Lyrical Onslaught** — Bars. Punch Lines. No Mercy.
2. **Story Mode**
3. **Beat Talk**
4. **Persona Pen**

**Freestyle Cypher** belongs to the larger Rhythm & Poetry event universe and can be introduced beyond the initial four-event pilot.

---

## 3. Event Lifecycle

### Queue
An event accepts entrants until its 16-person field is full.

### Lock / Creation Window
At 16 entrants the queue locks and the submission window opens. Event-specific source material (for example, an official beat) becomes available according to the event rules.

### Submission
The artist uploads the required creative work before the deadline. The event upload screen must already know the selected challenge; users do not choose the event again during upload.

### Judging
Judging assignments are distributed to eligible artists outside the event being judged. The assigned FateKeeper evaluates both submissions using the official scoring rubric and selects the winner.

### Blind Advancement
Tournament progression occurs internally. Contenders are **not notified round-by-round that they won or lost**. This protects suspense and prevents eliminated participants from abandoning remaining judging obligations.

### Completion / Reveal
After the required judging cycle is complete, results become available. The completed bracket, individual journey, opponents, outcomes, and final champion can then be revealed.

---

## 4. Judging Is a Condition of Survival

Judging is not optional side activity. It is part of entering the Arena.

> **If you do not judge, you lose.**

If an artist fails to complete a required judging assignment within the allowed window:

- the non-compliant artist is automatically eliminated from their own active competition path;
- the protocol must not stall because a FateKeeper disappeared;
- the unresolved competition path uses the MVP timeout/fallback resolution so the tournament can continue;
- the failure is recorded in the audit trail.

The product goal is a self-clearing tournament: inactive participants cannot deadlock the Arena.

---

## 5. The Three Battle Perspectives

The same battle has three distinct experiences.

### A. Contender View — Completed Battle Playback

A Contender does **not** watch the FateKeeper decide their own battle live.

While the event is underway, the system records/produces the visual representation of the FateKeeper's judgment: score influence, energy movement, timing, outcome, and finishing sequence.

After the relevant judging is complete, the Contender can watch the battle as a **playback of what already happened**.

The playback shows:

- both avatars;
- the FateKeeper's scoring influence as it unfolded;
- energy shifting between the competitors;
- the final result;
- the registered finishing move/fatality.

If the Contender won, their avatar performs their equipped finishing move on the defeated opponent. If they lost, they see the opponent's finishing move performed on them.

### B. FateKeeper View — Decision Interface

The FateKeeper is the person actually determining the battle outcome.

The interface includes:

- Artist A submission;
- Artist B submission;
- playback controls;
- scoring controls;
- official category definitions;
- judgment timer;
- final selection/lock action.

For submissions up to three minutes, the intended detailed judging experience allows up to two plays of each submission plus deliberation within the configured judging window.

### C. Spectator View — Live Arena

The Spectator sees **in real time** what the Contender will later receive as playback.

As the FateKeeper scores the battle, spectators can see the Arena visualization respond live: scoring influence, energy movement, momentum, resolution, and finishing sequence.

Spectator features can include:

- live viewing;
- Arena commentary;
- support/donations where enabled;
- post-result audience voting.

After the official result is locked and the finishing sequence plays, spectators may be asked:

> **Who do you think should have won?**

The audience vote **cannot change the official outcome**. It becomes calibration data that can help evaluate judging quality over time.

**FateKeeper decides. The Arena remembers.**

---

## 6. Current MVP Scoring Rubric

The current implemented MVP scoring categories are:

| Category | Weight |
| --- | ---: |
| Lyrics | 25% |
| Delivery | 20% |
| Originality | 20% |
| Flow | 15% |
| Impact | 20% |

These weights are the current MVP implementation. Future challenge types may use challenge-specific rubrics after testing and calibration.

---

## 7. FateKeeper Training Grounds

Training Grounds are **not available on Day 1** because the platform initially lacks trusted calibration data.

### Calibration Seed Phase

After enough real submissions exist:

1. Staff selects approximately **10 representative completed battles**.
2. A trusted review group collectively evaluates those battles. The initial target is approximately **7 trusted judgments per calibration battle**.
3. Those collective evaluations create the reference dataset.

### Qualification Cycle

A user entering Training Grounds:

1. completes the 10 calibration battles without seeing the reference outcome;
2. scores them using the official rubric;
3. has their results compared with the reference dataset;
4. receives a calibration/accuracy result.

Once Training Grounds are activated, qualification becomes a requirement for live FateKeeper duties.

### Re-training

If a user does not meet the qualification threshold, the initial MVP can require the same 10-battle cycle again after feedback. As the platform grows, the calibration bank should expand so additional/randomized cycles can be used.

The exact qualification threshold and comparison formula remain product decisions to be validated with real data.

---

## 8. Rank, EXP, and Badges

Rank is a competitive classification system, not a cosmetic purchase.

> **Badges cannot be bought. They are earned.**

A competitor earns EXP from completed competition performance. FateKeeper scoring from the artist's event contributes to the EXP calculation. The exact EXP formula is intentionally **not yet locked** and must be simulated/tested before production use.

Rank will eventually support:

- **Open Events** — anyone can enter;
- **Rank-Gated Events** — a minimum badge/rank is required;
- **Elite Events** — high-ranked competitors only;
- personalized Prize Boards showing events appropriate to a player's rank.

Established/verified professional artists or celebrities may receive an administrative **placement rank** so clearly established professionals are not artificially treated as entry-level competitors. Placement rank is not a purchasable badge.

Potential visual rank ladder currently includes:

**Bronze → Silver → Gold → Platinum → Diamond → Mythic**

The final EXP thresholds are still to be designed.

---

## 9. Avatars — Forge Your Identity

Artist Arcade profiles are Arena identities, not ordinary profile photos.

**Forge Your Identity** allows users to establish an avatar and eventually customize:

- armor/outfits;
- gear;
- cosmetic effects;
- badges/rank display;
- finishing moves.

Cosmetics may be earned or purchased. Competitive rank and official judging influence may not be purchased.

**Pay for identity, never pay for judgment.**

---

## 10. Finishing Moves / Fatalities

When a battle resolves, the winning avatar performs its equipped cinematic finishing move against the defeated avatar.

Finishing moves are a major emotional payoff and monetizable cosmetic layer, but they never affect competitive scoring.

The system can support:

- a default/free finishing move;
- seasonal finishing moves;
- earned finishing moves;
- premium purchasable finishing moves.

One established visual concept uses an enchanted written scroll fired by the victor, wrapping and constricting the opponent while musical energy erupts and the defeated avatar deteriorates.

---

## 11. Portals and Hubs

The world is navigated through game-like portals rather than ordinary application tabs.

### Compete / Contender Hub

- **Events** → Prize Board
- **Updates** → active challenges and Arena updates
- **Gear** → avatar customization
- **Portals** → change path/role

### FateKeeper's Quarters

- Training Grounds
- live judging assignments
- accuracy/calibration
- judgment history
- FateKeeper progression/reputation
- rewards

### Spectator Hub

Event-category portals lead spectators to active Arena experiences. The larger Rhythm & Poetry universe includes Lyrical Onslaught, Story Mode, Beat Talk, Persona Pen, and Freestyle Cypher.

---

## 12. Prize Board and Event Entry

The Prize Board communicates:

- event/challenge type;
- prize/pot;
- entry fee;
- status;
- deadline;
- rank requirement where applicable;
- event requirements.

The upload/submission experience communicates:

- selected event identity;
- challenge description;
- maximum submission length;
- official beat/source material and download action where applicable;
- unlock time;
- upload deadline;
- upload area;
- preview and metadata;
- final Enter the Arena/submit action.

---

## 13. Blind Results and Replay

Round-by-round outcomes are intentionally withheld from Contenders during an active tournament.

When the Arena closes, users can discover:

- how far they progressed;
- opponents they faced;
- completed battle playbacks;
- wins/losses;
- final bracket;
- champion.

This combines operational integrity with suspense and entertainment.

---

## 14. Economy

The MVP proves paid competition economics. Current pilot configuration uses a $1 entry and $5 winner prize in a 16-person event, with the remaining event pot becoming company revenue before operating/payment costs.

Longer-term revenue layers may include:

- competition platform share;
- sponsored events;
- branded challenges;
- avatar gear;
- finishing moves;
- seasonal cosmetics;
- promotional partnerships;
- live events;
- physical merchandise/costumes;
- compliant affiliate/sponsor pathways that allow users to earn entry credits.

Economic systems must never allow payment to purchase official competitive rank or judging influence.

---

## 15. Public Recruitment Experience

The pre-launch/recruitment website is a three-page experience:

### Landing

- official Artist Arcade crest;
- Arena environment;
- cinematic winner/loser action;
- **Calling All Artists**;
- **A New World Is Approaching**;
- email capture;
- **Become a Legend** CTA;
- animated **About** portal;
- animated **Challenges** portal.

### About

- FateKeeper above the scene;
- two stylized warriors flanking the content;
- centered, scrollable transparent/parchment-style proclamation panel;
- email CTA;
- **Watch the Intro** action;
- back navigation to Landing.

### Challenges

Four MVP challenge cards:

- Lyrical Onslaught
- Story Mode
- Beat Talk
- Persona Pen

The marketing page intentionally teases the challenge identities without revealing full mechanics. It includes a second **Become a Legend** signup CTA and back navigation.

---

## 16. Living-Screen Design Standard

Artist Arcade must feel like a premium game interface, not static artwork with web controls layered on top.

Motion should be cinematic and restrained:

- slow portal rotation;
- controlled glow/pulse;
- drifting particles/embers;
- spotlight movement;
- metallic light sweeps;
- rune/energy movement;
- responsive hover/touch states;
- subtle parallax;
- cinematic transitions.

The goal is **life and depth**, not visual noise.

---

## 17. Loading Experience

Loading is part of the world. The official crest can sit within animated rings/energy, with a progress indicator and rotating Arena sayings. Loading should reinforce the brand rather than display a generic spinner.

---

## 18. Expansion Architecture

Rhythm & Poetry is the first portal, not the final market.

The underlying engine is discipline-agnostic:

**Prompt/Challenge → Creation → Submission → Evaluation → Advancement → Reward**

Future realms may support illustration, photography, dance, production, film/video, fashion, writing, and other creative disciplines with discipline-specific scoring rubrics.

---

## 19. Physical Arena — Future Vision

The digital world can eventually extend into periodic live events where artists physically embody their avatars and compete in person — part performance event, gaming tournament, convention, fashion/costume experience, and concert.

Future opportunities include costume/fashion partnerships, licensed gear, tickets, sponsors, merchandise, livestreaming, regional/state competition, and championships.

This is **not MVP scope**.

---

## 20. What Is MVP vs. Future

### MVP must prove

- 64-artist / four-event operating structure;
- event entry and queue lock;
- submission flow;
- outside-event judging assignments;
- mandatory judging / timeout enforcement;
- bracket advancement;
- blind progression;
- event completion;
- prize/revenue ledgering;
- auditability;
- stable core experience.

### Post-MVP layers

- full cinematic contender playback;
- real-time spectator Arena visualization;
- audience calibration vote;
- Training Grounds after calibration data exists;
- EXP/rank gating after formula validation;
- deeper avatar/gear economy;
- expanded finishing-move library;
- additional creative portals;
- live physical events.

Some post-MVP experiences may be prototyped visually during MVP design even if they are not required for the first operational pilot.

---

## 21. Open Product Decisions

Do not silently invent these values in implementation. They require explicit product decisions or real-data validation:

- EXP award formula and rank thresholds;
- FateKeeper qualification/accuracy threshold;
- exact staff calibration aggregation method;
- challenge-specific scoring weights beyond the current MVP rubric;
- final penalty/re-entry rules after failure to judge;
- exact spectator voting/calibration formula;
- final cosmetic catalog and pricing;
- placement-rank policy for established professionals;
- long-term event visibility/matchmaking rules.

---

## 22. One-Sentence Definition

> **Artist Arcade is a competitive platform that turns artistic creation into a game: creators enter challenges, submit original work, judge one another through structured evaluation, and progress through tournament brackets for real prizes — where the work, not the follower count, determines who advances.**
