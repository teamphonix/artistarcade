# The Artist Arcade

> **Skill. Discipline. Truth.**

The Artist Arcade is a competitive creative platform that turns artistic creation into a game-like arena. Creators enter challenges, submit original work, judge other creators through a structured protocol, advance through tournament brackets, and compete for real prizes.

The first realm is **Rhythm & Poetry**.

## Current MVP

Season Zero is built around:

- 64 total artists
- 4 simultaneous events
- 16 artists per event
- single-elimination brackets
- one event per artist
- outside-event FateKeeper assignments
- 3-minute maximum submissions
- 24-hour submission window
- 15-minute judging window
- blind tournament progression until results are ready
- mandatory judging: failure to complete required judging can eliminate the non-compliant artist

The current four-event pilot uses:

1. Lyrical Onslaught
2. Story Mode
3. Beat Talk
4. Persona Pen

## Product Source of Truth

Read [`docs/PRODUCT-BIBLE.md`](docs/PRODUCT-BIBLE.md) before making product or UX assumptions. It documents the current product language, MVP boundaries, three battle perspectives, FateKeeper system, rank/EXP direction, avatars, finishing moves, Prize Board, public recruitment experience, and future roadmap.

Technical setup is documented in [`docs/mvp-setup.md`](docs/mvp-setup.md). Autonomous event behavior is documented in [`docs/autonomous-protocol.md`](docs/autonomous-protocol.md).

## Development

This is a Next.js application. Repository-specific agent instructions are in [`AGENTS.md`](AGENTS.md).

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Environment variables are described in `.env.example` and the MVP setup guide.
